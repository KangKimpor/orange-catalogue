-- Cover the import-review foreign keys used when resolving and reviewing catalogue changes.
CREATE INDEX IF NOT EXISTS import_changes_product_id_idx ON public.import_changes(product_id);
CREATE INDEX IF NOT EXISTS import_changes_variant_id_idx ON public.import_changes(variant_id);
