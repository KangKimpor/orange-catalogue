-- The preceding normalization migration reassigns every variant first. This cleanup
-- removes only the original generated color rows when no variant still references them.

DELETE FROM public.colors AS source
WHERE source.khmer_name IN (
  'ប្រផេះដិត',
  'ក្រហមដឹត',
  'ប្រផេះស្រាល',
  'ផ្ទៃំមេឃ',
  'ទិកបិច',
  'ទឹកប៊ិក',
  'ទឺកបិច',
  'ទីកសណ្តែក'
)
  AND source.normalized_key LIKE 'attribute-%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.variants AS variant
    WHERE variant.color_id = source.id
  );
