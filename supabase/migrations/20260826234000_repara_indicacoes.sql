-- Repara instalações que receberam a interface de indicações sem a migração
-- correspondente. A política não depende de funções expostas no schema public.
CREATE TABLE IF NOT EXISTS public.indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cpf_cnpj text,
  telefone text,
  email text,
  endereco text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicacoes TO authenticated;
GRANT ALL ON public.indicacoes TO service_role;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff gerencia indicações" ON public.indicacoes;
DROP POLICY IF EXISTS "Membros internos gerenciam indicações" ON public.indicacoes;
CREATE POLICY "Membros internos gerenciam indicações"
  ON public.indicacoes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'advogado', 'secretaria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'advogado', 'secretaria')
    )
  );

DROP TRIGGER IF EXISTS trg_indicacoes_updated ON public.indicacoes;
CREATE TRIGGER trg_indicacoes_updated
  BEFORE UPDATE ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS indicacao_id uuid REFERENCES public.indicacoes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_processos_indicacao_id ON public.processos(indicacao_id);
