-- Save POS state, not website presentation. Import history stays available after restores.
-- All entry points are server-only; the application verifies the admin session and PIN.
alter table public.imports add column if not exists catalogue_snapshot_json jsonb;
-- The live schema already has Just In; make a fresh migration-based setup equivalent.
alter table public.products add column if not exists is_just_in boolean not null default false;

create function public.merge_pos_snapshot(p_base jsonb, p_items jsonb, p_import_id integer)
returns jsonb language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(item order by item->>'posCode'), '[]'::jsonb)
  from (
    select item from jsonb_array_elements(p_base) item
    where not exists (select 1 from jsonb_array_elements(p_items) incoming where incoming->>'posCode' = item->>'posCode')
    union all
    select item || jsonb_build_object('sourceImportId', p_import_id) from jsonb_array_elements(p_items) item
  ) rows;
$$;

create function public.capture_current_pos_snapshot()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'posCode', variant.pos_code, 'cleanedCode', product.cleaned_code, 'slug', product.slug,
    'categorySlug', case when upper(left(product.cleaned_code, 2)) in ('ZS', 'ZL') then 'tops'
      when upper(left(product.cleaned_code, 2)) in ('SK', 'SJ', 'WJ', 'FJ') then 'jeans'
      when upper(left(product.cleaned_code, 2)) in ('SP', 'LP') then 'legwear' else null end,
    'colorKey', coalesce(color.normalized_key, 'one-color'), 'colorKhmer', color.khmer_name,
    'colorEnglish', coalesce(color.english_name, 'One Color'), 'colorHex', coalesce(color.hex, '#9A9A94'),
    'size', variant.size, 'price', variant.price, 'stockQuantity', variant.stock_quantity,
    'rawName', variant.raw_name, 'rawAttribute', variant.raw_attribute,
    'wasRemovedFromLatestImport', product.is_removed_from_latest_import,
    'sourceImportId', variant.last_seen_import_id
  ) order by variant.pos_code), '[]'::jsonb)
  from public.variants variant
  join public.products product on product.id = variant.product_id
  left join public.colors color on color.id = variant.color_id
  where variant.is_visible;
$$;

-- Historical state follows the existing retain-missing-variants rule. A missing source
-- prevents guessing an earlier state; the current live state can still be captured safely.
do $$
declare v_import record; v_state jsonb := '[]'::jsonb; v_complete boolean := true; v_latest integer;
begin
  for v_import in select * from public.imports where status = 'applied' order by applied_at nulls last, id loop
    if jsonb_typeof(v_import.source_items_json) is distinct from 'array' then v_complete := false; end if;
    if v_complete then
      v_state := public.merge_pos_snapshot(v_state, v_import.source_items_json, v_import.id);
      update public.imports set catalogue_snapshot_json = v_state where id = v_import.id;
    end if;
    v_latest := v_import.id;
  end loop;
  if v_latest is not null then
    update public.imports set catalogue_snapshot_json = public.capture_current_pos_snapshot() where id = v_latest;
    insert into public.store_settings(key, value) values ('current_pos_import_id', v_latest::text)
    on conflict (key) do nothing;
  end if;
end;
$$;

-- Retain the existing digest, validation, immutable-code, and review transaction.
-- The wrapper also serializes all apply/restore/delete operations using the same lock.
alter function public.apply_pos_import(integer, text, jsonb) rename to apply_pos_import_rows;

-- Compare against the current visible POS state after restores/replays, while the
-- immutable-code upsert retains the physical IDs and photo links of hidden variants.
create or replace function public.apply_pos_import_rows(
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
           exists (select 1 from public.variants sibling where sibling.is_visible and sibling.product_id = product.id and sibling.color_id = color.id) as color_exists,
           exists (select 1 from public.variants sibling where sibling.is_visible and sibling.product_id = product.id and sibling.color_id = color.id and sibling.size is not distinct from incoming.size) as size_exists
    from incoming
    join public.products as product on product.cleaned_code = incoming.cleaned_code
    join public.colors as color on color.normalized_key = incoming.color_key
    left join public.variants as variant on variant.pos_code = incoming.pos_code and variant.is_visible
    left join public.colors as previous_color on previous_color.id = variant.color_id
  ), prepared as (
    select resolved.*, row_number() over (partition by cleaned_code order by pos_code) as product_variant_position,
           case
             when variant_id is not null and previous_price is distinct from price and previous_stock is distinct from stock_quantity then 'price_and_stock_changed'
             when variant_id is not null and previous_price is distinct from price then 'price_changed'
             when variant_id is not null and previous_stock is distinct from stock_quantity then 'stock_changed'
             when variant_id is not null and (previous_color_id is distinct from color_id or previous_size is distinct from size or previous_raw_name is distinct from raw_name or previous_raw_attribute is distinct from raw_attribute) then 'variant_updated'
             when variant_id is not null then 'unchanged'
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
    select count(distinct (cleaned_code, color_key)) filter (where stored_change_type = 'new_color') as new_colors,
           count(distinct (cleaned_code, color_key, coalesce(size, ''))) filter (where stored_change_type = 'new_size') as new_sizes,
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
           exists (select 1 from public.variants sibling where sibling.is_visible and sibling.product_id = product.id and sibling.color_id = color.id) as color_exists,
           exists (select 1 from public.variants sibling where sibling.is_visible and sibling.product_id = product.id and sibling.color_id = color.id and sibling.size is not distinct from incoming.size) as size_exists
    from incoming
    join public.products as product on product.cleaned_code = incoming.cleaned_code
    join public.colors as color on color.normalized_key = incoming.color_key
    left join public.variants as variant on variant.pos_code = incoming.pos_code and variant.is_visible
    left join public.colors as previous_color on previous_color.id = variant.color_id
  ), prepared as (
    select resolved.*, row_number() over (partition by cleaned_code order by pos_code) as product_variant_position,
           case
             when variant_id is not null and previous_price is distinct from price and previous_stock is distinct from stock_quantity then 'price_and_stock_changed'
             when variant_id is not null and previous_price is distinct from price then 'price_changed'
             when variant_id is not null and previous_stock is distinct from stock_quantity then 'stock_changed'
             when variant_id is not null and (previous_color_id is distinct from color_id or previous_size is distinct from size or previous_raw_name is distinct from raw_name or previous_raw_attribute is distinct from raw_attribute) then 'variant_updated'
             when variant_id is not null then 'unchanged'
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
   where variant.is_visible and not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code);

  with incoming_codes as (select item."posCode" as pos_code from jsonb_to_recordset(p_items) as item("posCode" text)), missing_by_product as (
    select product.id as product_id, product.cleaned_code, product.is_removed_from_latest_import as was_removed,
           min(variant.pos_code) as first_pos_code, jsonb_agg(variant.pos_code order by variant.pos_code) as missing_pos_codes
    from public.variants as variant join public.products as product on product.id = variant.product_id
    where variant.is_visible and not exists (select 1 from incoming_codes where incoming_codes.pos_code = variant.pos_code)
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


create function public.apply_pos_import(p_import_id integer, p_digest text, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_summary jsonb; v_missing integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('orange_pos_import_rebuild', 0));
  v_summary := public.apply_pos_import_rows(p_import_id, p_digest, p_items);
  select count(*) into v_missing from public.variants
    where is_visible and last_seen_import_id is distinct from p_import_id;
  update public.products product set is_removed_from_latest_import =
    not exists (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible)
    or exists (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible and variant.last_seen_import_id is distinct from p_import_id)
    where product.id is not null;
  v_summary := v_summary || jsonb_build_object('missingVariants', v_missing);
  update public.imports set catalogue_snapshot_json = public.capture_current_pos_snapshot(), summary_json = v_summary where id = p_import_id;
  insert into public.store_settings(key, value) values ('current_pos_import_id', p_import_id::text)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return v_summary;
end;
$$;

create function public.get_pos_import_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'currentImportId', (select import.id from public.imports import join public.store_settings setting
      on setting.key = 'current_pos_import_id' and setting.value = import.id::text where import.status = 'applied'),
    'restorableImportIds', coalesce((select jsonb_agg(id order by applied_at desc, id desc) from public.imports
      where status = 'applied' and jsonb_typeof(catalogue_snapshot_json) = 'array'), '[]'::jsonb)
  );
$$;

create function public.restore_pos_import(p_import_id integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_import public.imports%rowtype;
  v_model record;
  v_slug text;
  v_suffix integer;
  v_restored integer;
  v_hidden integer;
  v_hidden_products integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('orange_pos_import_rebuild', 0));
  select * into v_import from public.imports where id = p_import_id for update;
  if not found or v_import.status is distinct from 'applied' then
    return jsonb_build_object('error', 'The selected saved import is unavailable.');
  end if;
  if exists (select 1 from public.store_settings where key = 'current_pos_import_id' and value = p_import_id::text) then
    return jsonb_build_object('error', 'This import is already current. Choose a different saved import.');
  end if;
  if jsonb_typeof(v_import.catalogue_snapshot_json) is distinct from 'array' then
    return jsonb_build_object('error', 'The complete POS state for this import is unavailable. Nothing was restored.');
  end if;
  if exists (select 1 from jsonb_array_elements(v_import.catalogue_snapshot_json) item
    group by item->>'posCode' having count(*) > 1 or coalesce(btrim(item->>'posCode'), '') = '') then
    raise exception 'The saved POS state contains invalid or duplicate codes.';
  end if;

  insert into public.colors(normalized_key, khmer_name, english_name, hex)
  select distinct on (item->>'colorKey') item->>'colorKey', item->>'colorKhmer', item->>'colorEnglish', item->>'colorHex'
    from jsonb_array_elements(v_import.catalogue_snapshot_json) item order by item->>'colorKey'
    on conflict (normalized_key) do nothing;

  for v_model in select distinct on (item->>'cleanedCode') item->>'cleanedCode' code, item->>'slug' slug,
    case when item->>'categorySlug' in ('shorts', 'pants') then 'legwear' else item->>'categorySlug' end category_slug
    from jsonb_array_elements(v_import.catalogue_snapshot_json) item order by item->>'cleanedCode'
  loop
    if not exists (select 1 from public.products where cleaned_code = v_model.code) then
      v_slug := v_model.slug; v_suffix := 0;
      while exists (select 1 from public.products where slug = v_slug) loop
        v_suffix := v_suffix + 1; v_slug := v_model.slug || '-' || substr(md5(v_model.code), 1, 6) || '-' || v_suffix;
      end loop;
      insert into public.products(slug, cleaned_code, category_id, category_source, review_status)
      select v_slug, v_model.code, category.id, case when category.id is null then 'unassigned' else 'rule' end,
        case when category.id is null then 'needs_review' else 'clean' end
        from (select 1) source left join public.categories category on category.slug = v_model.category_slug;
    end if;
  end loop;

  -- Keep physical variant IDs and their photo associations, even for later-only variants.
  update public.variants variant set is_visible = false
    where variant.is_visible and not exists (select 1 from jsonb_array_elements(v_import.catalogue_snapshot_json) item where item->>'posCode' = variant.pos_code);
  get diagnostics v_hidden = row_count;
  insert into public.variants(product_id, color_id, pos_code, size, price, stock_quantity, raw_name, raw_attribute, last_seen_import_id, is_visible)
  select product.id, color.id, item->>'posCode', item->>'size', (item->>'price')::numeric,
    (item->>'stockQuantity')::integer, item->>'rawName', item->>'rawAttribute', source_import.id, true
    from jsonb_array_elements(v_import.catalogue_snapshot_json) item
    join public.products product on product.cleaned_code = item->>'cleanedCode'
    join public.colors color on color.normalized_key = item->>'colorKey'
    left join public.imports source_import on source_import.id::text = item->>'sourceImportId'
    on conflict (pos_code) do update set product_id = excluded.product_id, color_id = excluded.color_id,
      size = excluded.size, price = excluded.price, stock_quantity = excluded.stock_quantity,
      raw_name = excluded.raw_name, raw_attribute = excluded.raw_attribute,
      last_seen_import_id = excluded.last_seen_import_id, is_visible = true;
  get diagnostics v_restored = row_count;
  if v_restored <> jsonb_array_length(v_import.catalogue_snapshot_json) then
    raise exception 'The saved POS state is incomplete. No restore changes were saved.';
  end if;

  -- Website names, categories, Just In, publication, lifecycle choices and media remain staff-owned.
  update public.products product set is_removed_from_latest_import =
    not exists (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible)
    or case when jsonb_typeof(v_import.source_items_json) = 'array' then exists
      (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible
        and not exists (select 1 from jsonb_array_elements(v_import.source_items_json) item where item->>'posCode' = variant.pos_code))
      else exists (select 1 from jsonb_array_elements(v_import.catalogue_snapshot_json) item
        where item->>'cleanedCode' = product.cleaned_code and item->>'wasRemovedFromLatestImport' = 'true') end
    where product.id is not null;
  select count(*) into v_hidden_products from public.products product
    where not exists (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible);
  insert into public.store_settings(key, value) values ('current_pos_import_id', p_import_id::text)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('restoredImportId', p_import_id, 'restoredVariants', v_restored, 'hiddenVariants', v_hidden, 'hiddenProducts', v_hidden_products);
end;
$$;

-- Deletion preserves the existing rebuild-from-retained-files behavior. The replay keeps
-- original timestamps, stable variant IDs, website metadata and all remote photo bindings.
create or replace function public.remove_pos_import_and_rebuild(p_import_id integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_target public.imports%rowtype;
  v_replay record;
  v_ids integer[];
  v_count integer := 0;
  v_variants integer;
  v_archived integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('orange_pos_import_rebuild', 0));
  select * into v_target from public.imports where id = p_import_id for update;
  if not found or v_target.status is distinct from 'applied' then
    return jsonb_build_object('error', 'The selected POS import is not available for removal.');
  end if;
  select coalesce(array_agg(id order by applied_at nulls last, id), '{}') into v_ids
    from public.imports where status = 'applied' and id <> p_import_id;
  if exists (select 1 from public.imports where id = any(v_ids) and jsonb_typeof(source_items_json) is distinct from 'array') then
    return jsonb_build_object('error', 'A retained POS source is unavailable. This import cannot be deleted safely.');
  end if;
  delete from public.imports where id = p_import_id;
  delete from public.import_changes where import_id = any(v_ids);
  update public.variants set is_visible = false where is_visible;
  get diagnostics v_variants = row_count;
  delete from public.store_settings where key = 'current_pos_import_id';
  for v_replay in select id, digest, source_items_json, applied_at from public.imports where id = any(v_ids) order by applied_at nulls last, id loop
    update public.imports set status = 'preview' where id = v_replay.id;
    perform public.apply_pos_import(v_replay.id, v_replay.digest, v_replay.source_items_json);
    update public.imports set applied_at = v_replay.applied_at where id = v_replay.id;
    v_count := v_count + 1;
  end loop;
  update public.products product set is_removed_from_latest_import = true
    where not exists (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible);
  select count(*) into v_archived from public.products product where not exists
    (select 1 from public.variants variant where variant.product_id = product.id and variant.is_visible);
  return jsonb_build_object('removedImportId', p_import_id, 'reappliedImports', v_count, 'removedVariants', v_variants,
    'removedProducts', 0, 'archivedProductsWithMedia', v_archived);
end;
$$;

revoke all on function public.merge_pos_snapshot(jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.capture_current_pos_snapshot() from public, anon, authenticated;
revoke all on function public.apply_pos_import_rows(integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.apply_pos_import(integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_pos_import_state() from public, anon, authenticated;
revoke all on function public.restore_pos_import(integer) from public, anon, authenticated;
revoke all on function public.remove_pos_import_and_rebuild(integer) from public, anon, authenticated;
grant execute on function public.merge_pos_snapshot(jsonb, jsonb, integer) to service_role;
grant execute on function public.capture_current_pos_snapshot() to service_role;
grant execute on function public.apply_pos_import_rows(integer, text, jsonb) to service_role;
grant execute on function public.apply_pos_import(integer, text, jsonb) to service_role;
grant execute on function public.get_pos_import_state() to service_role;
grant execute on function public.restore_pos_import(integer) to service_role;
grant execute on function public.remove_pos_import_and_rebuild(integer) to service_role;
