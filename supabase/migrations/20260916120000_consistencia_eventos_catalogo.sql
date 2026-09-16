-- Consistência de visibilidade e catálogos.
-- Não remove dados: preserva valores históricos dos processos e apenas
-- impede que eles voltem a aparecer como opções ativas.

DO $$
BEGIN
  IF to_regprocedure('private.is_staff(uuid)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY INVOKER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = _user_id
            AND role IN ('admin', 'advogado', 'secretaria')
        )
      $body$
    $fn$;
  ELSIF to_regprocedure('public.is_staff(uuid)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = _user_id
            AND role IN ('admin', 'advogado', 'secretaria')
        )
      $body$
    $fn$;
  END IF;
END
$$;

-- Corrige somente eventos ainda classificados como prazo cujo próprio título
-- identifica inequivocamente audiência ou perícia. Descrições não são usadas,
-- pois podem mencionar eventos relacionados sem mudar o tipo principal.
UPDATE public.prazos
SET tipo_evento = CASE
  WHEN lower(titulo) LIKE '%perícia%' OR lower(titulo) LIKE '%pericia%' THEN 'pericia'
  WHEN lower(titulo) LIKE '%audiência%' OR lower(titulo) LIKE '%audiencia%' THEN 'audiencia'
  ELSE tipo_evento
END
WHERE tipo_evento = 'prazo'
  AND (
    lower(titulo) LIKE '%perícia%'
    OR lower(titulo) LIKE '%pericia%'
    OR lower(titulo) LIKE '%audiência%'
    OR lower(titulo) LIKE '%audiencia%'
  );

CREATE INDEX IF NOT EXISTS idx_prazos_processo_tipo_status
  ON public.prazos (processo_id, tipo_evento, status, data_prazo);

