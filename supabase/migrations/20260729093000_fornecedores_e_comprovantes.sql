-- O bucket não existia, embora as políticas já tivessem sido criadas.
-- Isso causava o erro "Bucket not found".
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'notas-fiscais',
  'notas-fiscais',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "staff read notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "staff upload notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "staff update notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "staff delete notas fiscais" ON storage.objects;

CREATE POLICY "staff read notas fiscais"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notas-fiscais' AND public.is_staff(auth.uid()));

CREATE POLICY "staff upload notas fiscais"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notas-fiscais' AND public.is_staff(auth.uid()));

CREATE POLICY "staff update notas fiscais"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'notas-fiscais' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'notas-fiscais' AND public.is_staff(auth.uid()));

CREATE POLICY "staff delete notas fiscais"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notas-fiscais' AND public.is_staff(auth.uid()));
