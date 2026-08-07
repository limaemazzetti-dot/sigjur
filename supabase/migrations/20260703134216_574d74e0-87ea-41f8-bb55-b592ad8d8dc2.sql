
-- Restringe execução das security definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Substitui políticas overly permissive por checagem de papel
DROP POLICY IF EXISTS "plano_contas_all_authenticated" ON public.plano_contas;
CREATE POLICY "plano_contas_select" ON public.plano_contas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "plano_contas_write" ON public.plano_contas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'advogado'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'advogado'));

DROP POLICY IF EXISTS "lancamentos_all_authenticated" ON public.lancamentos;
CREATE POLICY "lancamentos_select" ON public.lancamentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "lancamentos_write" ON public.lancamentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
