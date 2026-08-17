-- Apply one previewed POS workbook atomically. Any validation or write failure aborts the
-- complete function transaction, so products, variants, audit rows, and import status
-- cannot be left partially applied.
create or replace function public.apply_pos_import(
  p_import_id integer,
  p_digest text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.imports%rowtype;
  v_product record;
  v_slug text;
  v_slug_suffix integer;
  v_new_product_codes text[] := '{}'::text[];
  v_new_products integer := 0;
  v_new_variants integer := 0;
  v_updated_variants integer := 0;
  v_missing_variants integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'The POS import items must be an array.' using errcode = 'P0001';
  end if;

  -- Serialize concurrent attempts to apply the same workbook digest, including distinct
  -- previews created for the same export.
  perform pg_advisory_xact_lock(hashtextextended(p_digest, 0));

  select *
    into v_import
    from public.imports
   where id = p_import_id
   for update;

  if not found or v_import.status <> 'preview' then
    raise exception 'The requested import preview is unavailable.' using errcode = 'P0001';
  end if;

  if v_import.digest <> p_digest then
    raise exception 'The file differs from the saved import preview. Create a new preview.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.imports
     where digest = p_digest
       and status = 'applied'
       and id <> p_import_id
     limit 1
  ) then
    raise exception 'This POS workbook was already applied. Upload a newer export instead.' using errcode = 'P0001';
  end if;

  if exists (
    with incoming as (
      select item."posCode" as pos_code
        from jsonb_to_recordset(p_items) as item("posCode" text)
    )
    select 1
      from incoming
     group by pos_code
    having count(*) > 1
       or coalesce(btrim(pos_code), '') = ''
     limit 1
  ) then
    raise exception 'The import contains invalid or duplicate immutable POS Codes.' using errcode = 'P0001';
  end if;

  -- Attribute colors are immutable POS source values. Existing color labels are retained.
  with incoming as (
    select item."colorKey" as color_key,
           item."colorKhmer" as color_khmer,
           item."colorEnglish" as color_english,
           item."colorHex" as color_hex
      from jsonb_to_recordset(p_items) as item(
        "colorKey" text,
        "colorKhmer" text,
        "colorEnglish" text,
        "colorHex" text
      )
  ), colors_to_insert as (
    select distinct on (color_key) color_key, color_khmer, color_english, color_hex
      from incoming
     order by color_key
  )
  insert into public.colors (khmer_name, english_name, hex, normalized_key)
  select color_khmer, color_english, color_hex, color_key
    from colors_to_insert
  on conflict (normalized_key) do nothing;

  -- Products are created only for new cleaned-code models. Resolve slug collisions inside
  -- the transaction so a partial or concurrent import cannot reserve an inconsistent slug.
  for v_product in
    with incoming as (
      select item."cleanedCode" as cleaned_code,
             item.slug as proposed_slug,
             item."categorySlug" as category_slug
        from jsonb_to_recordset(p_items) as item(
          "cleanedCode" text,
          slug text,
          "categorySlug" text
        )
    )
    select distinct on (cleaned_code) cleaned_code, proposed_slug, category_slug
      from incoming
     order by cleaned_code, proposed_slug
  loop
    if not exists (select 1 from public.products where cleaned_code = v_product.cleaned_code) then
      v_slug := v_product.proposed_slug;
      v_slug_suffix := 0;
      while exists (select 1 from public.products where slug = v_slug) loop
        v_slug_suffix := v_slug_suffix + 1;
        v_slug := v_product.proposed_slug || '-' || substr(md5(v_product.cleaned_code), 1, 6)
          || case when v_slug_suffix = 1 then '' else '-' || v_slug_suffix::text end;
      end loop;

      insert into public.products (slug, cleaned_code, category_id, category_source, review_status)
      select v_slug,
             v_product.cleaned_code,
             category.id,
             case when v_product.category_slug is null then 'unassigned' else 'rule' end,
             case when v_product.category_slug is null then 'needs_review' else 'clean' end
        from (select 1) as source
        left join public.categories as category on category.slug = v_product.category_slug;

      v_new_product_codes := array_append(v_new_product_codes, v_product.cleaned_code);
    end if;
  end loop;
  v_new_products := coalesce(array_length(v_new_product_codes, 1), 0);

  -- POS rules may update rule-derived categories but never overwrite a staff-owned manual
  -- category, website name, lifecycle state, Just In membership, or media association.
  with incoming as (
    select item."cleanedCode" as cleaned_code,
           item."categorySlug" as category_slug
      from jsonb_to_recordset(p_items) as item(
        "cleanedCode" text,
        "categorySlug" text
      )
  ), models as (
    select distinct on (cleaned_code) cleaned_code, category_slug
      from incoming
     order by cleaned_code
  ), resolved as (
    select models.cleaned_code,
           category.id as category_id,
           case when models.category_slug is null then 'unassigned' else 'rule' end as category_source,
           case when models.category_slug is null then 'needs_review' else 'clean' end as review_status
      from models
      left join public.categories as category on category.slug = models.category_slug
  )
  update public.products as product
     set is_removed_from_latest_import = false,
         category_id = case when product.category_source = 'manual' then product.category_id else resolved.category_id end,
         category_source = case when product.category_source = 'manual' then product.category_source else resolved.category_source end,
         review_status = case when product.category_source = 'manual' then product.review_status else resolved.review_status end
    from resolved
   where product.cleaned_code = resolved.cleaned_code;

  -- Measure the exact audit summary before the immutable POS-code upsert overwrites the
  -- existing variant values needed by the newest-import rollback function.
  with incoming as (
    select item."posCode" as pos_code,
           item."cleanedCode" as cleaned_code,
           item."colorKey" as color_key,
           item.size as size,
           item.price as price,
           item."stockQuantity" as stock_quantity
      from jsonb_to_recordset(p_items) as item(
        "posCode" text,
        "cleanedCode" text,
        "colorKey" text,
        size text,
        price numeric,
        "stockQuantity" integer
      )
  ), resolved as (
    select incoming.*,
           color.id as color_id,
           variant.id as variant_id,
           variant.color_id as previous_color_id,
           variant.size as previous_size,
           variant.price as previous_price,
           variant.stock_quantity as previous_stock
      from incoming
      join public.colors as color on color.normalized_key = incoming.color_key
      left join public.variants as variant on variant.pos_code = incoming.pos_code
  )
  select count(*) filter (where variant_id is null),
         count(*) filter (where variant_id is not null and (
           previous_color_id is distinct from color_id
           or previous_size is distinct from size
           or previous_price is distinct from price
           or previous_stock is distinct from stock_quantity
         ))
    into v_new_variants, v_updated_variants
    from resolved;

  -- Upsert every POS row and write rollback-compatible history in the same statement.
  with incoming as (
    select item."posCode" as pos_code,
           item."cleanedCode" as cleaned_code,
           item."colorEnglish" as color_english,
           item."colorKey" as color_key,
           item.size as size,
           item.price as price,
           item."stockQuantity" as stock_quantity
      from jsonb_to_recordset(p_items) as item(
        "posCode" text,
        "cleanedCode" text,
        "colorEnglish" text,
        "colorKey" text,
        size text,
        price numeric,
        "stockQuantity" integer
      )
  ), resolved as (
    select incoming.*,
           product.id as product_id,
           color.id as color_id,
           variant.id as variant_id,
           variant.color_id as previous_color_id,
           previous_color.english_name as previous_color,
           variant.size as previous_size,
           variant.price as previous_price,
           variant.stock_quantity as previous_stock
      from incoming
      join public.products as product on product.cleaned_code = incoming.cleaned_code
      join public.colors as color on color.normalized_key = incoming.color_key
      left join public.variants as variant on variant.pos_code = incoming.pos_code
      left join public.colors as previous_color on previous_color.id = variant.color_id
  ), prepared as (
    select resolved.*,
           row_number() over (partition by cleaned_code order by pos_code) as product_variant_position,
           case
             when variant_id is null and cleaned_code = any(v_new_product_codes) then 'new_product'
             when variant_id is null then 'new_variant'
             else 'stock_price_update'
           end as change_type,
           variant_id is not null and (
             previous_color_id is distinct from color_id
             or previous_size is distinct from size
             or previous_price is distinct from price
             or previous_stock is distinct from stock_quantity
           ) as is_updated
      from resolved
  ), upserted as (
    insert into public.variants (product_id, color_id, pos_code, size, price, stock_quantity, last_seen_import_id, is_visible)
    select product_id, color_id, pos_code, size, price, stock_quantity, p_import_id, true
      from prepared
    on conflict (pos_code) do update
      set product_id = excluded.product_id,
          color_id = excluded.color_id,
          size = excluded.size,
          price = excluded.price,
          stock_quantity = excluded.stock_quantity,
          last_seen_import_id = excluded.last_seen_import_id,
          is_visible = excluded.is_visible
    returning id, pos_code
  )
  insert into public.import_changes (import_id, product_id, variant_id, pos_code, change_type, before_json, after_json)
  select p_import_id,
         prepared.product_id,
         upserted.id,
         prepared.pos_code,
         case
           when prepared.change_type = 'new_product' and prepared.product_variant_position > 1 then 'new_variant'
           else prepared.change_type
         end,
         case when prepared.variant_id is null then null else jsonb_build_object(
           'code', prepared.cleaned_code,
           'posCode', prepared.pos_code,
           'color', prepared.previous_color,
           'colorId', prepared.previous_color_id,
           'size', prepared.previous_size,
           'previousPrice', prepared.previous_price,
           'previousStock', prepared.previous_stock
         ) end,
         case when prepared.variant_id is null then jsonb_build_object(
           'changeType', case when prepared.change_type = 'new_product' and prepared.product_variant_position > 1 then 'new_variant' else prepared.change_type end,
           'code', prepared.cleaned_code,
           'posCode', prepared.pos_code,
           'color', prepared.color_english,
           'colorId', prepared.color_id,
           'size', prepared.size,
           'price', prepared.price,
           'stock', prepared.stock_quantity
         ) else jsonb_build_object(
           'changeType', 'updated',
           'code', prepared.cleaned_code,
           'posCode', prepared.pos_code,
           'color', prepared.color_english,
           'previousColor', prepared.previous_color,
           'colorId', prepared.color_id,
           'previousColorId', prepared.previous_color_id,
           'size', prepared.size,
           'previousSize', prepared.previous_size,
           'colorChanged', prepared.previous_color_id is distinct from prepared.color_id,
           'sizeChanged', prepared.previous_size is distinct from prepared.size,
           'priceChanged', prepared.previous_price is distinct from prepared.price,
           'stockChanged', prepared.previous_stock is distinct from prepared.stock_quantity,
           'previousPrice', prepared.previous_price,
           'price', prepared.price,
           'previousStock', prepared.previous_stock,
           'stock', prepared.stock_quantity
         ) end
    from prepared
    join upserted on upserted.pos_code = prepared.pos_code
   where prepared.variant_id is null or prepared.is_updated;

  with incoming_codes as (
    select item."posCode" as pos_code
      from jsonb_to_recordset(p_items) as item("posCode" text)
  )
  select count(*)
    into v_missing_variants
    from public.variants as variant
   where not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code);

  -- Missing POS codes remain non-destructive. Record the review detail before flagging the
  -- affected models so newest-import removal can restore their prior missing-state value.
  with incoming_codes as (
    select item."posCode" as pos_code
      from jsonb_to_recordset(p_items) as item("posCode" text)
  ), missing_by_product as (
    select product.id as product_id,
           product.cleaned_code,
           product.is_removed_from_latest_import as was_removed,
           min(variant.pos_code) as first_pos_code,
           jsonb_agg(variant.pos_code order by variant.pos_code) as missing_pos_codes
      from public.variants as variant
      join public.products as product on product.id = variant.product_id
     where not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code)
     group by product.id, product.cleaned_code, product.is_removed_from_latest_import
  )
  insert into public.import_changes (import_id, product_id, variant_id, pos_code, change_type, before_json, after_json)
  select p_import_id,
         product_id,
         null,
         first_pos_code,
         'missing_from_import',
         jsonb_build_object('code', cleaned_code, 'wasRemovedFromLatestImport', was_removed),
         jsonb_build_object('changeType', 'missing', 'code', cleaned_code, 'posCode', first_pos_code, 'missingPosCodes', missing_pos_codes)
    from missing_by_product;

  with incoming_codes as (
    select item."posCode" as pos_code
      from jsonb_to_recordset(p_items) as item("posCode" text)
  )
  update public.products as product
     set is_removed_from_latest_import = true
   where exists (
     select 1
       from public.variants as variant
      where variant.product_id = product.id
        and not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code)
   );

  update public.imports
     set status = 'applied',
         applied_at = now(),
         summary_json = jsonb_build_object(
           'newProducts', v_new_products,
           'newVariants', v_new_variants,
           'updatedVariants', v_updated_variants,
           'missingVariants', v_missing_variants
         )
   where id = p_import_id;

  return jsonb_build_object(
    'newProducts', v_new_products,
    'newVariants', v_new_variants,
    'updatedVariants', v_updated_variants,
    'missingVariants', v_missing_variants
  );
end;
$$;

revoke all on function public.apply_pos_import(integer, text, jsonb) from public;
grant execute on function public.apply_pos_import(integer, text, jsonb) to service_role;
