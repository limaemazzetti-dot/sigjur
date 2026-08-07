
-- Catálogo de opções configuráveis
CREATE TABLE public.catalogo_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN ('tipo_acao','materia','fase','advogado')),
  valor text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria, valor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_opcoes TO authenticated;
GRANT ALL ON public.catalogo_opcoes TO service_role;

ALTER TABLE public.catalogo_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gerencia catálogo" ON public.catalogo_opcoes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_catalogo_opcoes_updated
  BEFORE UPDATE ON public.catalogo_opcoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vínculos entre clientes (ex.: mãe -> menor)
CREATE TABLE public.cliente_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_principal_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cliente_vinculado_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  parentesco text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_principal_id, cliente_vinculado_id),
  CHECK (cliente_principal_id <> cliente_vinculado_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_vinculos TO authenticated;
GRANT ALL ON public.cliente_vinculos TO service_role;

ALTER TABLE public.cliente_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gerencia vínculos" ON public.cliente_vinculos
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_cliente_vinculos_updated
  BEFORE UPDATE ON public.cliente_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cliente_vinculos_principal ON public.cliente_vinculos(cliente_principal_id);

-- Referência ao "outro envolvido" no processo
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS outro_envolvido_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
