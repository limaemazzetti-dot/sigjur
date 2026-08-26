-- Links públicos possuem token somente em hash; nenhum dado interno de cliente é exposto.
CREATE TABLE IF NOT EXISTS public.contrato_links_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  nome text NOT NULL DEFAULT 'Kit BPC/LOAS com Representante',
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revogado_em timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contrato_formularios_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.contrato_links_publicos(id) ON DELETE CASCADE,
  dados jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_links_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_formularios_publicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contrato_links_publicos, public.contrato_formularios_publicos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_links_publicos, public.contrato_formularios_publicos TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_link_publico_contrato(p_nome text DEFAULT 'Kit BPC/LOAS com Representante')
RETURNS TABLE (id uuid, token text, expira_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text := encode(extensions.gen_random_bytes(32), 'hex'); v_id uuid; v_expira timestamptz := now() + interval '30 days';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'advogado', 'secretaria')) THEN
    RAISE EXCEPTION 'Sem permissão para criar links públicos';
  END IF;
  INSERT INTO contrato_links_publicos (token_hash, nome, expira_em, criado_por)
  VALUES (encode(extensions.digest(v_token, 'sha256'), 'hex'), coalesce(nullif(trim(p_nome), ''), 'Kit BPC/LOAS com Representante'), v_expira, auth.uid()) RETURNING contrato_links_publicos.id INTO v_id;
  RETURN QUERY SELECT v_id, v_token, v_expira;
END; $$;

CREATE OR REPLACE FUNCTION public.consultar_link_publico_contrato(p_token text)
RETURNS TABLE (nome text, expira_em timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT nome, expira_em FROM contrato_links_publicos
  WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND revogado_em IS NULL AND expira_em > now();
$$;

CREATE OR REPLACE FUNCTION public.enviar_formulario_publico_contrato(p_token text, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id uuid; v_link uuid;
BEGIN
  SELECT id INTO v_link FROM contrato_links_publicos WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND revogado_em IS NULL AND expira_em > now();
  IF v_link IS NULL THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
  INSERT INTO contrato_formularios_publicos(link_id, dados) VALUES (v_link, p_dados) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.criar_link_publico_contrato(text), public.consultar_link_publico_contrato(text), public.enviar_formulario_publico_contrato(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_link_publico_contrato(text), public.enviar_formulario_publico_contrato(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_link_publico_contrato(text) TO authenticated;
