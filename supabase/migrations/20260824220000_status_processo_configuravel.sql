-- Status de processo configuráveis. A coluna deixa de usar enum para aceitar
-- novas opções cadastradas pelo escritório, preservando todos os valores atuais.
ALTER TABLE public.processos
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE text USING status::text,
  ALTER COLUMN status SET DEFAULT 'inicial';

CREATE TABLE public.status_processo_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z0-9_]+$'),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.status_processo_opcoes (codigo, nome) VALUES
  ('inicial', 'Inicial'),
  ('em_andamento', 'Em andamento'),
  ('execucao', 'Execução'),
  ('recurso', 'Recurso'),
  ('concluso_sentenca', 'Concluso p/ sentença'),
  ('suspenso', 'Suspenso'),
  ('arquivado', 'Arquivado'),
  ('julgado_procedente', 'Julgado procedente'),
  ('julgado_improcedente', 'Julgado improcedente'),
  ('acordo', 'Acordo')
ON CONFLICT (codigo) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_processo_opcoes TO authenticated;
GRANT ALL ON public.status_processo_opcoes TO service_role;
ALTER TABLE public.status_processo_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia status de processo" ON public.status_processo_opcoes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_status_processo_opcoes_updated
  BEFORE UPDATE ON public.status_processo_opcoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
