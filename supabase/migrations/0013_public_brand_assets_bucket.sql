-- Public delivery bucket for immutable, versioned Orange brand assets.
-- Public buckets permit downloads only; no storage.objects write policy is retained.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-assets', 'brand-assets', true, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png'];

DROP POLICY IF EXISTS allow_anon_brand_logo_insert ON storage.objects;
DROP POLICY IF EXISTS allow_anon_brand_logo_select ON storage.objects;
DROP POLICY IF EXISTS allow_anon_brand_logo_update ON storage.objects;
