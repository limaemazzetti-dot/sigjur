
-- ================== CLIENTES ==================
CREATE TYPE public.tipo_cliente AS ENUM ('pf', 'pj');

CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.tipo_cliente NOT NULL DEFAULT 'pf',
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  rg TEXT,
  email TEXT,
  telefone TEXT,
  profissao TEXT,
  data_aniversario DATE,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY clientes_write ON public.clientes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER clientes_set_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX clientes_aniversario_idx ON public.clientes (data_aniversario);
CREATE INDEX clientes_nome_idx ON public.clientes (nome);

-- ================== PROCESSOS ==================
CREATE TYPE public.status_processo AS ENUM (
  'inicial', 'em_andamento', 'execucao', 'recurso',
  'concluso_sentenca', 'suspenso', 'arquivado',
  'julgado_procedente', 'julgado_improcedente', 'acordo'
);

CREATE TABLE public.processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_cnj TEXT,
  autor TEXT NOT NULL,
  reu TEXT NOT NULL,
  status public.status_processo NOT NULL DEFAULT 'inicial',
  materia TEXT,
  vara TEXT,
  tribunal TEXT,
  comarca TEXT,
  data_protocolo DATE,
  data_encerramento DATE,
  origem TEXT,
  valor_causa NUMERIC(14,2),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  observacoes TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos TO authenticated;
GRANT ALL ON public.processos TO service_role;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY processos_select ON public.processos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY processos_write ON public.processos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER processos_set_updated_at BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX processos_cliente_idx ON public.processos (cliente_id);
CREATE INDEX processos_status_idx ON public.processos (status);
CREATE INDEX processos_materia_idx ON public.processos (materia);

-- ================== ANDAMENTOS ==================
CREATE TABLE public.andamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.andamentos TO authenticated;
GRANT ALL ON public.andamentos TO service_role;
ALTER TABLE public.andamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY andamentos_select ON public.andamentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY andamentos_write ON public.andamentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER andamentos_set_updated_at BEFORE UPDATE ON public.andamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX andamentos_processo_idx ON public.andamentos (processo_id, data DESC);

-- Vincular lançamentos a processos (opcional) — adiciona coluna se ainda não existir
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS lancamentos_processo_idx ON public.lancamentos (processo_id);
