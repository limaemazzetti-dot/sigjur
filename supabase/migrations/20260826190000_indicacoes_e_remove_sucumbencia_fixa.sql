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
CREATE POLICY "Staff gerencia indicações" ON public.indicacoes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_indicacoes_updated ON public.indicacoes;
CREATE TRIGGER trg_indicacoes_updated
  BEFORE UPDATE ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS indicacao_id uuid REFERENCES public.indicacoes(id) ON DELETE RESTRICT,
  DROP COLUMN IF EXISTS sucumbencias_valor;

CREATE INDEX IF NOT EXISTS idx_processos_indicacao_id ON public.processos(indicacao_id);
