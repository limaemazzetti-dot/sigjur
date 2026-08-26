-- Endurecimento de acesso: somente integrantes internos podem consultar dados
-- jurídicos/financeiros diretamente pela API do Supabase. A service_role
-- continua exclusiva do backend e não deve ser exposta ao navegador.

REVOKE ALL ON TABLE public.clientes FROM anon;
REVOKE ALL ON TABLE public.processos FROM anon;
REVOKE ALL ON TABLE public.andamentos FROM anon;
REVOKE ALL ON TABLE public.lancamentos FROM anon;
REVOKE ALL ON TABLE public.prazos FROM anon;
REVOKE ALL ON TABLE public.backups_snapshots FROM anon;
REVOKE ALL ON TABLE public.documentos_gerados FROM anon;
REVOKE ALL ON TABLE public.documento_templates FROM anon;

-- Compatibilidade com a versão anterior do banco: a tela e os lançamentos
-- usam este vínculo, mas instalações antigas ainda não tinham a coluna.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS fornecedor boolean NOT NULL DEFAULT false;

-- Backups contêm uma cópia integral de informações pessoais e financeiras;
-- portanto não podem ser lidos, criados ou removidos por editores.
DROP POLICY IF EXISTS "Staff can view all backups" ON public.backups_snapshots;
DROP POLICY IF EXISTS "Staff can create backups" ON public.backups_snapshots;
DROP POLICY IF EXISTS "Staff can delete backups" ON public.backups_snapshots;

CREATE POLICY "Admins manage backups"
  ON public.backups_snapshots FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- A senha gov.br passa a receber ciphertext AES-GCM no backend. As permissões
-- por coluna impedem que o acesso autenticado direto leia, inclua ou altere a
-- credencial. A escrita normal ocorre pelo backend com service_role depois de
-- autenticação e autorização de editor.
REVOKE SELECT, INSERT, UPDATE ON TABLE public.clientes FROM authenticated;
GRANT SELECT (
  id, tipo, fornecedor, nome, cpf_cnpj, rg, email, telefone, profissao,
  nacionalidade, data_aniversario, sexo, estado_civil, como_conheceu,
  endereco, bairro, cidade, estado, cep, observacoes, criado_por, created_at,
  updated_at, representante_nome, representante_nacionalidade,
  representante_profissao, representante_data_nascimento, representante_rg,
  representante_cpf, representante_parentesco, template_ids
) ON public.clientes TO authenticated;
GRANT INSERT (
  id, tipo, fornecedor, nome, cpf_cnpj, rg, email, telefone, profissao,
  nacionalidade, data_aniversario, sexo, estado_civil, como_conheceu,
  endereco, bairro, cidade, estado, cep, observacoes, criado_por,
  representante_nome, representante_nacionalidade, representante_profissao,
  representante_data_nascimento, representante_rg, representante_cpf,
  representante_parentesco, template_ids
) ON public.clientes TO authenticated;
GRANT UPDATE (
  tipo, fornecedor, nome, cpf_cnpj, rg, email, telefone, profissao,
  nacionalidade, data_aniversario, sexo, estado_civil, como_conheceu,
  endereco, bairro, cidade, estado, cep, observacoes, criado_por,
  representante_nome, representante_nacionalidade, representante_profissao,
  representante_data_nascimento, representante_rg, representante_cpf,
  representante_parentesco, template_ids
) ON public.clientes TO authenticated;

-- As funções de apoio do RLS não são endpoints da aplicação. Elas permanecem
-- utilizáveis pelas políticas já existentes pelo OID interno, mas saem do
-- schema exposto pela API e deixam de ser chamáveis por usuários finais.
CREATE SCHEMA IF NOT EXISTS private;
DO $$
BEGIN
  IF to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL THEN
    ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
  END IF;
  IF to_regprocedure('public.is_staff(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.is_staff(uuid) SET SCHEMA private;
  END IF;
END
$$;
ALTER FUNCTION private.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION private.is_staff(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

-- Função de manutenção encontrada pelo Security Advisor: não deve ser uma
-- função RPC pública. O bloco é idempotente para bancos antigos que não a têm.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
  END IF;
END
$$;
