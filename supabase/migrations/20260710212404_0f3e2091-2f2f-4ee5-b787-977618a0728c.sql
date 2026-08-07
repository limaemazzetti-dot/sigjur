-- As políticas RLS em clientes/processos/prazos/plano_contas/... chamam
-- is_staff(auth.uid()) e has_role(auth.uid(), ...). Em Postgres, avaliar a
-- expressão da policy exige EXECUTE na função, mesmo quando ela é
-- SECURITY DEFINER. Sem o GRANT, toda consulta falha com
-- "permission denied for function is_staff".
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;