
-- Add nota_fiscal_path column to lancamentos
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS nota_fiscal_path text;

-- RLS policies for the private notas-fiscais bucket: any staff (admin/advogado) can read/write
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
