
CREATE TYPE public.status_prazo AS ENUM ('aberto','cumprido','cancelado');
CREATE TYPE public.prioridade_prazo AS ENUM ('baixa','media','alta');

CREATE TABLE public.prazos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  data_prazo date NOT NULL,
  status public.status_prazo NOT NULL DEFAULT 'aberto',
  prioridade public.prioridade_prazo NOT NULL DEFAULT 'media',
  data_conclusao date,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prazos_status_data_idx ON public.prazos (status, data_prazo);
CREATE INDEX prazos_processo_idx ON public.prazos (processo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prazos TO authenticated;
GRANT ALL ON public.prazos TO service_role;

ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prazos_select" ON public.prazos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "prazos_write" ON public.prazos TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER prazos_set_updated_at BEFORE UPDATE ON public.prazos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
