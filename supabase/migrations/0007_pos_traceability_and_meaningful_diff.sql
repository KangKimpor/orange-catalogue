-- Preserve the original POS source values used to derive a variant. Parsed color and size
-- continue to drive the catalogue UI, while these fields provide import traceability.
alter table public.variants
  add column if not exists raw_name text,
  add column if not exists raw_attribute text;

alter table public.imports
  add column if not exists source_export_date date;

alter table public.import_changes
  drop constraint if exists import_changes_change_type_check;

alter table public.import_changes
  add constraint import_changes_change_type_check check (
    change_type in (
      'new_product',
      'new_color',
      'new_size',
      'new_variant',
      'price_changed',
      'stock_changed',
      'price_and_stock_changed',
      'variant_updated',
      'stock_price_update',
      'missing_from_import',
      'needs_review'
    )
  );

-- Retain newest-import removal compatibility while extending the audit taxonomy above.
create or replace function public.rollback_pos_import(p_import_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest_import_id integer;
  v_import_status text;
  v_new_product_ids integer[] := '{}';
  v_new_variant_ids integer[] := '{}';
  v_media_count integer := 0;
  v_restored_variants integer := 0;
  v_restored_missing_products integer := 0;
  v_removed_variants integer := 0;
  v_removed_products integer := 0;
begin
  select id into v_latest_import_id
  from imports
  where status = 'applied'
  order by applied_at desc nulls last, id desc
  limit 1;

  if v_latest_import_id is distinct from p_import_id then
    raise exception 'Only the most recent applied POS import can be removed.' using errcode = 'P0001';
  end if;

  select status into v_import_status from imports where id = p_import_id;
  if v_import_status is distinct from 'applied' then
    raise exception 'The selected POS import is not available for removal.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct product_id) filter (where change_type = 'new_product' and product_id is not null), '{}'),
         coalesce(array_agg(distinct variant_id) filter (where change_type in ('new_product', 'new_color', 'new_size', 'new_variant') and variant_id is not null), '{}')
    into v_new_product_ids, v_new_variant_ids
  from import_changes
  where import_id = p_import_id;

  select count(*) into v_media_count
  from product_media
  where product_id = any(v_new_product_ids)
     or variant_id = any(v_new_variant_ids);

  if v_media_count > 0 then
    raise exception 'This import cannot be removed while its newly imported items have photos attached. Remove the affected photo associations first.' using errcode = 'P0001';
  end if;

  update variants as variant
     set price = case when change.after_json ->> 'priceChanged' = 'true' then (change.before_json ->> 'previousPrice')::numeric else variant.price end,
         stock_quantity = case when change.after_json ->> 'stockChanged' = 'true' then (change.before_json ->> 'previousStock')::integer else variant.stock_quantity end,
         color_id = case when change.after_json ->> 'colorChanged' = 'true' then (change.before_json ->> 'colorId')::integer else variant.color_id end,
         size = case when change.after_json ->> 'sizeChanged' = 'true' then change.before_json ->> 'size' else variant.size end,
         raw_name = case when change.after_json ->> 'rawNameChanged' = 'true' then change.before_json ->> 'rawName' else variant.raw_name end,
         raw_attribute = case when change.after_json ->> 'rawAttributeChanged' = 'true' then change.before_json ->> 'rawAttribute' else variant.raw_attribute end,
         last_seen_import_id = case when variant.last_seen_import_id = p_import_id then null else variant.last_seen_import_id end
    from import_changes as change
   where change.import_id = p_import_id
     and change.change_type in ('price_changed', 'stock_changed', 'price_and_stock_changed', 'variant_updated', 'stock_price_update')
     and change.variant_id = variant.id;
  get diagnostics v_restored_variants = row_count;

  update products as product
     set is_removed_from_latest_import = coalesce((change.before_json ->> 'wasRemovedFromLatestImport')::boolean, false)
    from import_changes as change
   where change.import_id = p_import_id
     and change.change_type = 'missing_from_import'
     and change.product_id = product.id;
  get diagnostics v_restored_missing_products = row_count;

  update import_changes
     set product_id = null,
         variant_id = null
   where import_id = p_import_id
     and change_type in ('new_product', 'new_color', 'new_size', 'new_variant');

  delete from variants where id = any(v_new_variant_ids);
  get diagnostics v_removed_variants = row_count;

  delete from products where id = any(v_new_product_ids);
  get diagnostics v_removed_products = row_count;

  update imports
     set status = 'rolled_back'
   where id = p_import_id;

  return jsonb_build_object(
    'removedImportId', p_import_id,
    'removedProducts', v_removed_products,
    'removedVariants', v_removed_variants,
    'restoredVariants', v_restored_variants,
    'restoredMissingProducts', v_restored_missing_products
  );
end;
$$;

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
  v_new_colors integer := 0;
  v_new_sizes integer := 0;
  v_new_variants integer := 0;
  v_price_changes integer := 0;
  v_stock_changes integer := 0;
  v_price_and_stock_changes integer := 0;
  v_updated_variants integer := 0;
  v_missing_variants integer := 0;
  v_summary jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'The POS import items must be an array.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_digest, 0));

  select * into v_import from public.imports where id = p_import_id for update;
  if not found or v_import.status <> 'preview' then
    raise exception 'The requested import preview is unavailable.' using errcode = 'P0001';
  end if;
  if v_import.digest <> p_digest then
    raise exception 'The file differs from the saved import preview. Create a new preview.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.imports where digest = p_digest and status = 'applied' and id <> p_import_id limit 1) then
    raise exception 'This POS workbook was already applied. Upload a newer export instead.' using errcode = 'P0001';
  end if;
  if exists (
    with incoming as (select item."posCode" as pos_code from jsonb_to_recordset(p_items) as item("posCode" text))
    select 1 from incoming group by pos_code having count(*) > 1 or coalesce(btrim(pos_code), '') = '' limit 1
  ) then
    raise exception 'The import contains invalid or duplicate immutable POS Codes.' using errcode = 'P0001';
  end if;

  -- POS Attribute colors remain source-owned. Existing color labels are never overwritten.
  with incoming as (
    select item."colorKey" as color_key, item."colorKhmer" as color_khmer, item."colorEnglish" as color_english, item."colorHex" as color_hex
    from jsonb_to_recordset(p_items) as item("colorKey" text, "colorKhmer" text, "colorEnglish" text, "colorHex" text)
  ), colors_to_insert as (
    select distinct on (color_key) color_key, color_khmer, color_english, color_hex from incoming order by color_key
  )
  insert into public.colors (khmer_name, english_name, hex, normalized_key)
  select color_khmer, color_english, color_hex, color_key from colors_to_insert
  on conflict (normalized_key) do nothing;

  -- Products are grouped by cleaned code, while variants below always remain keyed by POS Code.
  for v_product in
    with incoming as (
      select item."cleanedCode" as cleaned_code, item.slug as proposed_slug, item."categorySlug" as category_slug
      from jsonb_to_recordset(p_items) as item("cleanedCode" text, slug text, "categorySlug" text)
    )
    select distinct on (cleaned_code) cleaned_code, proposed_slug, category_slug from incoming order by cleaned_code, proposed_slug
  loop
    if not exists (select 1 from public.products where cleaned_code = v_product.cleaned_code) then
      v_slug := v_product.proposed_slug;
      v_slug_suffix := 0;
      while exists (select 1 from public.products where slug = v_slug) loop
        v_slug_suffix := v_slug_suffix + 1;
        v_slug := v_product.proposed_slug || '-' || substr(md5(v_product.cleaned_code), 1, 6) || case when v_slug_suffix = 1 then '' else '-' || v_slug_suffix::text end;
      end loop;
      insert into public.products (slug, cleaned_code, category_id, category_source, review_status)
      select v_slug, v_product.cleaned_code, category.id,
             case when v_product.category_slug is null then 'unassigned' else 'rule' end,
             case when v_product.category_slug is null then 'needs_review' else 'clean' end
      from (select 1) as source
      left join public.categories as category on category.slug = v_product.category_slug;
      v_new_product_codes := array_append(v_new_product_codes, v_product.cleaned_code);
    end if;
  end loop;
  v_new_products := coalesce(array_length(v_new_product_codes, 1), 0);

  with incoming as (
    select item."cleanedCode" as cleaned_code, item."categorySlug" as category_slug
    from jsonb_to_recordset(p_items) as item("cleanedCode" text, "categorySlug" text)
  ), models as (
    select distinct on (cleaned_code) cleaned_code, category_slug from incoming order by cleaned_code
  ), resolved as (
    select models.cleaned_code, category.id as category_id,
           case when models.category_slug is null then 'unassigned' else 'rule' end as category_source,
           case when models.category_slug is null then 'needs_review' else 'clean' end as review_status
    from models left join public.categories as category on category.slug = models.category_slug
  )
  update public.products as product
     set is_removed_from_latest_import = false,
         category_id = case when product.category_source = 'manual' then product.category_id else resolved.category_id end,
         category_source = case when product.category_source = 'manual' then product.category_source else resolved.category_source end,
         review_status = case when product.category_source = 'manual' then product.review_status else resolved.review_status end
    from resolved where product.cleaned_code = resolved.cleaned_code;

  -- Classify every candidate before upserting. This preserves the old values used by
  -- history and rollback, and distinguishes new colors/sizes from new POS variants.
  with incoming as (
    select item."posCode" as pos_code, item."cleanedCode" as cleaned_code, item."colorKhmer" as color_khmer,
           item."colorEnglish" as color_english, item."colorKey" as color_key, item.size as size,
           item.price as price, item."stockQuantity" as stock_quantity, item."rawName" as raw_name,
           item."rawAttribute" as raw_attribute
    from jsonb_to_recordset(p_items) as item(
      "posCode" text, "cleanedCode" text, "colorKhmer" text, "colorEnglish" text, "colorKey" text,
      size text, price numeric, "stockQuantity" integer, "rawName" text, "rawAttribute" text
    )
  ), resolved as (
    select incoming.*, product.id as product_id, color.id as color_id,
           variant.id as variant_id, variant.color_id as previous_color_id, previous_color.khmer_name as previous_color_khmer,
           previous_color.english_name as previous_color_english, variant.size as previous_size,
           variant.price as previous_price, variant.stock_quantity as previous_stock,
           variant.raw_name as previous_raw_name, variant.raw_attribute as previous_raw_attribute,
           exists (select 1 from public.variants sibling where sibling.product_id = product.id and sibling.color_id = color.id) as color_exists,
           exists (select 1 from public.variants sibling where sibling.product_id = product.id and sibling.color_id = color.id and sibling.size is not distinct from incoming.size) as size_exists
    from incoming
    join public.products as product on product.cleaned_code = incoming.cleaned_code
    join public.colors as color on color.normalized_key = incoming.color_key
    left join public.variants as variant on variant.pos_code = incoming.pos_code
    left join public.colors as previous_color on previous_color.id = variant.color_id
  ), prepared as (
    select resolved.*, row_number() over (partition by cleaned_code order by pos_code) as product_variant_position,
           case
             when variant_id is not null and previous_price is distinct from price and previous_stock is distinct from stock_quantity then 'price_and_stock_changed'
             when variant_id is not null and previous_price is distinct from price then 'price_changed'
             when variant_id is not null and previous_stock is distinct from stock_quantity then 'stock_changed'
             when variant_id is not null and (previous_color_id is distinct from color_id or previous_size is distinct from size or previous_raw_name is distinct from raw_name or previous_raw_attribute is distinct from raw_attribute) then 'variant_updated'
             when variant_id is null and cleaned_code = any(v_new_product_codes) then 'new_product'
             when variant_id is null and not color_exists then 'new_color'
             when variant_id is null and not size_exists then 'new_size'
             else 'new_variant'
           end as change_type
    from resolved
  ), classified as (
    select prepared.*, case when change_type = 'new_product' and product_variant_position > 1 then 'new_variant' else change_type end as stored_change_type
    from prepared
  ), counted as (
    select count(distinct cleaned_code || chr(0) || color_key) filter (where stored_change_type = 'new_color') as new_colors,
           count(distinct cleaned_code || chr(0) || color_key || chr(0) || coalesce(size, '')) filter (where stored_change_type = 'new_size') as new_sizes,
           count(*) filter (where stored_change_type = 'new_variant') as new_variants,
           count(*) filter (where stored_change_type = 'price_changed') as price_changes,
           count(*) filter (where stored_change_type = 'stock_changed') as stock_changes,
           count(*) filter (where stored_change_type = 'price_and_stock_changed') as price_and_stock_changes,
           count(*) filter (where stored_change_type in ('price_changed', 'stock_changed', 'price_and_stock_changed', 'variant_updated')) as updated_variants
      from classified
  )
  select coalesce(counted.new_colors, 0), coalesce(counted.new_sizes, 0), coalesce(counted.new_variants, 0),
         coalesce(counted.price_changes, 0), coalesce(counted.stock_changes, 0), coalesce(counted.price_and_stock_changes, 0), coalesce(counted.updated_variants, 0)
    into v_new_colors, v_new_sizes, v_new_variants, v_price_changes, v_stock_changes, v_price_and_stock_changes, v_updated_variants
    from counted;

  with incoming as (
    select item."posCode" as pos_code, item."cleanedCode" as cleaned_code, item."colorKhmer" as color_khmer,
           item."colorEnglish" as color_english, item."colorKey" as color_key, item.size as size,
           item.price as price, item."stockQuantity" as stock_quantity, item."rawName" as raw_name,
           item."rawAttribute" as raw_attribute
    from jsonb_to_recordset(p_items) as item(
      "posCode" text, "cleanedCode" text, "colorKhmer" text, "colorEnglish" text, "colorKey" text,
      size text, price numeric, "stockQuantity" integer, "rawName" text, "rawAttribute" text
    )
  ), resolved as (
    select incoming.*, product.id as product_id, color.id as color_id,
           variant.id as variant_id, variant.color_id as previous_color_id, previous_color.khmer_name as previous_color_khmer,
           previous_color.english_name as previous_color_english, variant.size as previous_size,
           variant.price as previous_price, variant.stock_quantity as previous_stock,
           variant.raw_name as previous_raw_name, variant.raw_attribute as previous_raw_attribute,
           exists (select 1 from public.variants sibling where sibling.product_id = product.id and sibling.color_id = color.id) as color_exists,
           exists (select 1 from public.variants sibling where sibling.product_id = product.id and sibling.color_id = color.id and sibling.size is not distinct from incoming.size) as size_exists
    from incoming
    join public.products as product on product.cleaned_code = incoming.cleaned_code
    join public.colors as color on color.normalized_key = incoming.color_key
    left join public.variants as variant on variant.pos_code = incoming.pos_code
    left join public.colors as previous_color on previous_color.id = variant.color_id
  ), prepared as (
    select resolved.*, row_number() over (partition by cleaned_code order by pos_code) as product_variant_position,
           case
             when variant_id is not null and previous_price is distinct from price and previous_stock is distinct from stock_quantity then 'price_and_stock_changed'
             when variant_id is not null and previous_price is distinct from price then 'price_changed'
             when variant_id is not null and previous_stock is distinct from stock_quantity then 'stock_changed'
             when variant_id is not null and (previous_color_id is distinct from color_id or previous_size is distinct from size or previous_raw_name is distinct from raw_name or previous_raw_attribute is distinct from raw_attribute) then 'variant_updated'
             when variant_id is null and cleaned_code = any(v_new_product_codes) then 'new_product'
             when variant_id is null and not color_exists then 'new_color'
             when variant_id is null and not size_exists then 'new_size'
             else 'new_variant'
           end as change_type
    from resolved
  ), classified as (
    select prepared.*, case when change_type = 'new_product' and product_variant_position > 1 then 'new_variant' else change_type end as stored_change_type
    from prepared
  ), upserted as (
    insert into public.variants (product_id, color_id, pos_code, size, price, stock_quantity, raw_name, raw_attribute, last_seen_import_id, is_visible)
    select product_id, color_id, pos_code, size, price, stock_quantity, raw_name, raw_attribute, p_import_id, true from classified
    on conflict (pos_code) do update
      set product_id = excluded.product_id,
          color_id = excluded.color_id,
          size = excluded.size,
          price = excluded.price,
          stock_quantity = excluded.stock_quantity,
          raw_name = excluded.raw_name,
          raw_attribute = excluded.raw_attribute,
          last_seen_import_id = excluded.last_seen_import_id,
          is_visible = excluded.is_visible
    returning id, pos_code
  )
  insert into public.import_changes (import_id, product_id, variant_id, pos_code, change_type, before_json, after_json)
  select p_import_id, classified.product_id, upserted.id, classified.pos_code, classified.stored_change_type,
         case when classified.variant_id is null then null else jsonb_build_object(
           'code', classified.cleaned_code, 'posCode', classified.pos_code,
           'color', coalesce(classified.previous_color_khmer, classified.previous_color_english), 'colorId', classified.previous_color_id,
           'size', classified.previous_size, 'previousPrice', classified.previous_price, 'previousStock', classified.previous_stock,
           'rawName', classified.previous_raw_name, 'rawAttribute', classified.previous_raw_attribute
         ) end,
         jsonb_build_object(
           'changeType', classified.stored_change_type, 'code', classified.cleaned_code, 'posCode', classified.pos_code,
           'color', coalesce(classified.color_khmer, classified.color_english), 'colorId', classified.color_id,
           'size', classified.size, 'price', classified.price, 'stock', classified.stock_quantity,
           'priceChanged', classified.previous_price is distinct from classified.price,
           'stockChanged', classified.previous_stock is distinct from classified.stock_quantity,
           'colorChanged', classified.previous_color_id is distinct from classified.color_id,
           'sizeChanged', classified.previous_size is distinct from classified.size,
           'rawName', classified.raw_name, 'rawAttribute', classified.raw_attribute,
           'rawNameChanged', classified.previous_raw_name is distinct from classified.raw_name,
           'rawAttributeChanged', classified.previous_raw_attribute is distinct from classified.raw_attribute,
           'previousPrice', classified.previous_price, 'previousStock', classified.previous_stock,
           'previousColor', coalesce(classified.previous_color_khmer, classified.previous_color_english),
           'previousColorId', classified.previous_color_id, 'previousSize', classified.previous_size
         )
    from classified join upserted on upserted.pos_code = classified.pos_code
   where classified.variant_id is null
      or classified.stored_change_type in ('price_changed', 'stock_changed', 'price_and_stock_changed', 'variant_updated');

  with incoming_codes as (select item."posCode" as pos_code from jsonb_to_recordset(p_items) as item("posCode" text))
  select count(*) into v_missing_variants from public.variants as variant
   where not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code);

  with incoming_codes as (select item."posCode" as pos_code from jsonb_to_recordset(p_items) as item("posCode" text)), missing_by_product as (
    select product.id as product_id, product.cleaned_code, product.is_removed_from_latest_import as was_removed,
           min(variant.pos_code) as first_pos_code, jsonb_agg(variant.pos_code order by variant.pos_code) as missing_pos_codes
    from public.variants as variant join public.products as product on product.id = variant.product_id
    where not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code)
    group by product.id, product.cleaned_code, product.is_removed_from_latest_import
  )
  insert into public.import_changes (import_id, product_id, variant_id, pos_code, change_type, before_json, after_json)
  select p_import_id, product_id, null, first_pos_code, 'missing_from_import',
         jsonb_build_object('code', cleaned_code, 'wasRemovedFromLatestImport', was_removed),
         jsonb_build_object('changeType', 'missing', 'code', cleaned_code, 'posCode', first_pos_code, 'missingPosCodes', missing_pos_codes)
  from missing_by_product;

  with incoming_codes as (select item."posCode" as pos_code from jsonb_to_recordset(p_items) as item("posCode" text))
  update public.products as product set is_removed_from_latest_import = true
   where exists (
     select 1 from public.variants as variant
      where variant.product_id = product.id and not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code)
   );

  v_summary := coalesce(v_import.summary_json, '{}'::jsonb) || jsonb_build_object(
    'newProducts', v_new_products,
    'newColors', v_new_colors,
    'newSizes', v_new_sizes,
    'newVariants', v_new_variants,
    'priceChanges', v_price_changes,
    'stockChanges', v_stock_changes,
    'priceAndStockChanges', v_price_and_stock_changes,
    'updatedVariants', v_updated_variants,
    'missingVariants', v_missing_variants
  );

  update public.imports set status = 'applied', applied_at = now(), summary_json = v_summary where id = p_import_id;
  return v_summary;
end;
$$;

revoke all on function public.apply_pos_import(integer, text, jsonb) from public;
grant execute on function public.apply_pos_import(integer, text, jsonb) to service_role;
revoke all on function public.rollback_pos_import(integer) from public;
grant execute on function public.rollback_pos_import(integer) to service_role;
