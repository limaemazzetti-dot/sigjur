
CREATE TABLE public.documento_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'contrato',
  conteudo TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_templates TO authenticated;
GRANT ALL ON public.documento_templates TO service_role;
ALTER TABLE public.documento_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_select" ON public.documento_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "templates_write" ON public.documento_templates FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER documento_templates_set_updated_at BEFORE UPDATE ON public.documento_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.documentos_gerados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.documento_templates(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'contrato',
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_gerados TO authenticated;
GRANT ALL ON public.documentos_gerados TO service_role;
ALTER TABLE public.documentos_gerados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select" ON public.documentos_gerados FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "docs_write" ON public.documentos_gerados FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX documentos_gerados_cliente_idx ON public.documentos_gerados(cliente_id);
CREATE TRIGGER documentos_gerados_set_updated_at BEFORE UPDATE ON public.documentos_gerados FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed com dois modelos base (contrato e procuração)
INSERT INTO public.documento_templates (nome, tipo, conteudo) VALUES
('Contrato de Prestação de Serviços', 'contrato',
'CONTRATO DE PRESTAÇÃO DE SERVIÇOS PERICIAIS

CONTRATANTE: {{nome}}, {{tipo_pessoa}}, inscrito(a) no CPF/CNPJ sob nº {{cpf_cnpj}}, RG {{rg}}, residente à {{endereco}}, {{cidade}}/{{estado}}, CEP {{cep}}, telefone {{telefone}}, e-mail {{email}}.

CONTRATADO: [Preencher dados do contratado]

CLÁUSULA 1ª — OBJETO
O presente contrato tem por objeto a prestação de serviços periciais ao(à) CONTRATANTE.

CLÁUSULA 2ª — HONORÁRIOS
Os honorários serão pagos conforme acordado entre as partes.

CLÁUSULA 3ª — FORO
Fica eleito o foro da comarca de {{cidade}}/{{estado}}.

{{cidade}}, {{data_hoje}}.

_______________________________
{{nome}}'
),
('Procuração', 'procuracao',
'PROCURAÇÃO

OUTORGANTE: {{nome}}, {{tipo_pessoa}}, inscrito(a) no CPF/CNPJ sob nº {{cpf_cnpj}}, RG {{rg}}, {{profissao}}, residente à {{endereco}}, {{cidade}}/{{estado}}, CEP {{cep}}.

OUTORGADO: [Preencher dados do outorgado]

PODERES: Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui como seu bastante procurador o(a) OUTORGADO acima qualificado, a quem confere amplos poderes para representá-lo(a) em juízo ou fora dele, podendo ingressar com ações, defender-se, transigir, receber, dar quitação e substabelecer.

{{cidade}}, {{data_hoje}}.

_______________________________
{{nome}}'
);
