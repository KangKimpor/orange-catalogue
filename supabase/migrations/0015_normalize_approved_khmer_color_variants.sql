-- Preserve the Khmer POS source in variants.raw_attribute while giving approved
-- spelling variants a stable English storefront color and canonical color record.

INSERT INTO public.colors (khmer_name, english_name, hex, normalized_key)
VALUES
  ('ប្រផេះដិត', 'Dark Grey', '#5A5852', 'dark-grey'),
  ('ក្រហមដឹត', 'Dark Red', '#7A2A20', 'dark-red'),
  ('ប្រផេះស្រាល', 'Light Grey', '#B8B6B0', 'light-grey'),
  ('ទីកសណ្តែក', 'Beige', '#D2B48C', 'beige')
ON CONFLICT (normalized_key) DO UPDATE
SET
  english_name = EXCLUDED.english_name,
  hex = EXCLUDED.hex;

WITH merge_map AS (
  SELECT 'ទិកបិច'::text AS source_khmer_name, 'ink-blue'::text AS target_key
  UNION ALL SELECT 'ទឹកប៊ិក', 'ink-blue'
  UNION ALL SELECT 'ទឺកបិច', 'ink-blue'
  UNION ALL SELECT 'ផ្ទៃំមេឃ', 'sky-blue'
  UNION ALL SELECT 'ប្រផេះដិត', 'dark-grey'
  UNION ALL SELECT 'ក្រហមដឹត', 'dark-red'
  UNION ALL SELECT 'ប្រផេះស្រាល', 'light-grey'
  UNION ALL SELECT 'ទីកសណ្តែក', 'beige'
), source_colors AS (
  SELECT source.id AS source_color_id, target.id AS target_color_id
  FROM merge_map
  JOIN public.colors AS source
    ON source.khmer_name = merge_map.source_khmer_name
  JOIN public.colors AS target
    ON target.normalized_key = merge_map.target_key
  WHERE source.id <> target.id
), reassigned_variants AS (
  UPDATE public.variants AS variant
  SET color_id = source_colors.target_color_id
  FROM source_colors
  WHERE variant.color_id = source_colors.source_color_id
  RETURNING variant.id
)
DELETE FROM public.colors AS source
USING merge_map
WHERE source.khmer_name = merge_map.source_khmer_name
  AND source.normalized_key LIKE 'attribute-%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.variants AS variant
    WHERE variant.color_id = source.id
  );
