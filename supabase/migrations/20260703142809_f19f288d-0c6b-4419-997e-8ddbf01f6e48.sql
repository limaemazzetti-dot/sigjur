
-- Helper: verifica se usuário é admin ou advogado
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','advogado')
  )
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- CLIENTES
DROP POLICY IF EXISTS clientes_select ON public.clientes;
DROP POLICY IF EXISTS clientes_write ON public.clientes;
CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY clientes_write ON public.clientes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- PROCESSOS
DROP POLICY IF EXISTS processos_select ON public.processos;
DROP POLICY IF EXISTS processos_write ON public.processos;
CREATE POLICY processos_select ON public.processos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY processos_write ON public.processos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ANDAMENTOS
DROP POLICY IF EXISTS andamentos_select ON public.andamentos;
DROP POLICY IF EXISTS andamentos_write ON public.andamentos;
CREATE POLICY andamentos_select ON public.andamentos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY andamentos_write ON public.andamentos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- LANCAMENTOS
DROP POLICY IF EXISTS lancamentos_select ON public.lancamentos;
DROP POLICY IF EXISTS lancamentos_write ON public.lancamentos;
CREATE POLICY lancamentos_select ON public.lancamentos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY lancamentos_write ON public.lancamentos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- PLANO DE CONTAS
DROP POLICY IF EXISTS plano_contas_select ON public.plano_contas;
DROP POLICY IF EXISTS plano_contas_write ON public.plano_contas;
CREATE POLICY plano_contas_select ON public.plano_contas FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY plano_contas_write ON public.plano_contas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'advogado'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'advogado'));

-- Restringe função de trigger interna
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
