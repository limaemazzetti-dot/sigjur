DROP POLICY IF EXISTS plano_contas_write ON public.plano_contas;
CREATE POLICY plano_contas_write ON public.plano_contas
  FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));