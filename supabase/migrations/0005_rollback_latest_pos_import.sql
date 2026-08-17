-- Safely remove the latest applied POS import. The import audit remains as rolled_back;
-- only data created or changed by that import is reversed.
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
         coalesce(array_agg(distinct variant_id) filter (where change_type in ('new_product', 'new_variant') and variant_id is not null), '{}')
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
         last_seen_import_id = case when variant.last_seen_import_id = p_import_id then null else variant.last_seen_import_id end
    from import_changes as change
   where change.import_id = p_import_id
     and change.change_type = 'stock_price_update'
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
     and change_type in ('new_product', 'new_variant');

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

revoke all on function public.rollback_pos_import(integer) from public;
grant execute on function public.rollback_pos_import(integer) to service_role;
