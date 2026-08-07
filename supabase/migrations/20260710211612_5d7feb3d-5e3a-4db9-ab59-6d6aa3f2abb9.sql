-- Impede que usuários autenticados chamem has_role/is_staff diretamente via RPC
-- (enumeração de papéis). As funções são SECURITY DEFINER e continuam sendo
-- avaliadas em políticas RLS normalmente, pois o planner as executa como owner.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO service_role;