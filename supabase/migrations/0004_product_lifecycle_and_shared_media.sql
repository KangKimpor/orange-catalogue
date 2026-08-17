-- Staff-controlled storefront lifecycle. POS imports never overwrite this value.
alter table public.products
  add column if not exists lifecycle_status text not null default 'active';

alter table public.products
  drop constraint if exists products_lifecycle_status_check;

alter table public.products
  add constraint products_lifecycle_status_check
  check (lifecycle_status in ('active', 'out_of_stock', 'discontinued'));

-- Preserve the intent of any earlier archived product records.
update public.products
set lifecycle_status = 'discontinued'
where review_status = 'archived'
  and lifecycle_status = 'active';

create index if not exists products_lifecycle_status_idx
  on public.products(lifecycle_status);

-- The same Cloudinary asset can be used as content on a newly imported model.
-- Associations remain separate records, so removing an association does not remove
-- the binary asset while another product still uses it.
alter table public.product_media
  drop constraint if exists product_media_cloudinary_public_id_key;

drop index if exists public.product_media_cloudinary_public_id_key;

create index if not exists product_media_cloudinary_public_id_idx
  on public.product_media(cloudinary_public_id);
