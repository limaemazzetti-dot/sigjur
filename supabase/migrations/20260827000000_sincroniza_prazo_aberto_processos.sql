-- Mantém a coluna exibida em Processos sincronizada com a Agenda. Audiências
-- e perícias também são eventos da tabela prazos, diferenciados por tipo_evento.
CREATE OR REPLACE FUNCTION public.sincronizar_prazo_aberto_processo(p_processo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_processo_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.processos processo
  SET prazo_em_aberto = (
    processo.data_prazo IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.prazos evento
      WHERE evento.processo_id = processo.id
        AND evento.status = 'aberto'
    )
  )
  WHERE processo.id = p_processo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sincronizar_prazo_aberto_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.sincronizar_prazo_aberto_processo(OLD.processo_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.sincronizar_prazo_aberto_processo(NEW.processo_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prazos_sincroniza_processo ON public.prazos;
CREATE TRIGGER prazos_sincroniza_processo
AFTER INSERT OR UPDATE OF processo_id, status OR DELETE ON public.prazos
FOR EACH ROW EXECUTE FUNCTION public.trg_sincronizar_prazo_aberto_processo();

CREATE OR REPLACE FUNCTION public.trg_sincronizar_prazo_do_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sincronizar_prazo_aberto_processo(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS processos_sincroniza_prazo_aberto ON public.processos;
CREATE TRIGGER processos_sincroniza_prazo_aberto
AFTER INSERT OR UPDATE OF data_prazo ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.trg_sincronizar_prazo_do_processo();

-- Corrige registros já existentes imediatamente quando esta migração for aplicada.
UPDATE public.processos processo
SET prazo_em_aberto = (
  processo.data_prazo IS NOT NULL
  OR EXISTS (
    SELECT 1
    FROM public.prazos evento
    WHERE evento.processo_id = processo.id
      AND evento.status = 'aberto'
  )
);
