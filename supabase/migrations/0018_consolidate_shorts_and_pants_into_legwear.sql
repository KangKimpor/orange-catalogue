-- Consolidate the public Shorts and Pants taxonomy into a single Legwear category.
-- Preserve each product's existing category_source and all related names, variants, photos,
-- lifecycle state, and import history; only the category foreign key changes.

DO $$
DECLARE
  v_legwear_id integer;
BEGIN
  INSERT INTO public.categories (slug, label, sort_order, is_visible)
  VALUES ('legwear', 'Legwear', 3, true)
  ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      is_visible = EXCLUDED.is_visible
  RETURNING id INTO v_legwear_id;

  UPDATE public.products
  SET category_id = v_legwear_id
  WHERE category_id IN (
    SELECT id
    FROM public.categories
    WHERE slug IN ('shorts', 'pants')
  );

  -- Import removal rebuilds the catalogue from stored source snapshots. Normalize
  -- historical category payloads before removing their legacy lookup rows.
  UPDATE public.imports
  SET source_items_json = (
    SELECT jsonb_agg(
      CASE WHEN source.item->>'categorySlug' IN ('shorts', 'pants')
        THEN jsonb_set(source.item, '{categorySlug}', to_jsonb('legwear'::text))
        ELSE source.item
      END
      ORDER BY source.ordinality
    )
    FROM jsonb_array_elements(source_items_json) WITH ORDINALITY AS source(item, ordinality)
  )
  WHERE jsonb_typeof(source_items_json) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(source_items_json) AS item
      WHERE item->>'categorySlug' IN ('shorts', 'pants')
    );

  -- The foreign key uses ON DELETE SET NULL, but rows are deleted only after all
  -- affected products have been reassigned to Legwear.
  DELETE FROM public.categories
  WHERE slug IN ('shorts', 'pants');
END $$;
