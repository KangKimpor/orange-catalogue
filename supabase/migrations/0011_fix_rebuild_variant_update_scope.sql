-- The production safe-update policy rejects unrestricted UPDATE statements, including inside RPC functions.
-- Clear only variants that still reference an applied POS import before rebuilding the remaining snapshots.
create or replace function public.remove_pos_import_and_rebuild(p_import_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_import public.imports%rowtype;
  v_replay_ids integer[] := '{}';
  v_replay record;
  v_missing_snapshot_count integer := 0;
  v_reapplied_imports integer := 0;
  v_removed_variants integer := 0;
  v_removed_products integer := 0;
  v_archived_products integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('orange_pos_import_rebuild', 0));

  select * into v_target_import
  from public.imports
  where id = p_import_id
  for update;

  if not found or v_target_import.status is distinct from 'applied' then
    raise exception 'The selected POS import is not available for removal.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id order by applied_at nulls last, id), '{}')
    into v_replay_ids
  from public.imports
  where status = 'applied'
    and id <> p_import_id;

  select count(*) into v_missing_snapshot_count
  from public.imports
  where id = any(v_replay_ids)
    and jsonb_typeof(source_items_json) is distinct from 'array';

  if v_missing_snapshot_count > 0 then
    raise exception 'This import cannot be removed safely because one or more retained POS source snapshots are unavailable.' using errcode = 'P0001';
  end if;

  delete from public.imports where id = p_import_id;

  delete from public.import_changes where import_id = any(v_replay_ids);

  update public.variants
     set last_seen_import_id = null
   where last_seen_import_id is not null;
  delete from public.variants;
  get diagnostics v_removed_variants = row_count;

  update public.imports
     set status = 'preview',
         applied_at = null
   where id = any(v_replay_ids);

  for v_replay in
    select id, digest, source_items_json
    from public.imports
    where id = any(v_replay_ids)
    order by applied_at nulls last, id
  loop
    perform public.apply_pos_import(v_replay.id, v_replay.digest, v_replay.source_items_json);
    v_reapplied_imports := v_reapplied_imports + 1;
  end loop;

  delete from public.products as product
   where not exists (select 1 from public.variants as variant where variant.product_id = product.id)
     and not exists (select 1 from public.product_media as media where media.product_id = product.id);
  get diagnostics v_removed_products = row_count;

  update public.products as product
     set lifecycle_status = 'discontinued',
         is_removed_from_latest_import = true
   where not exists (select 1 from public.variants as variant where variant.product_id = product.id);
  get diagnostics v_archived_products = row_count;

  return jsonb_build_object(
    'removedImportId', p_import_id,
    'reappliedImports', v_reapplied_imports,
    'removedVariants', v_removed_variants,
    'removedProducts', v_removed_products,
    'archivedProductsWithMedia', v_archived_products
  );
end;
$$;

revoke all on function public.remove_pos_import_and_rebuild(integer) from public;
grant execute on function public.remove_pos_import_and_rebuild(integer) to service_role;
