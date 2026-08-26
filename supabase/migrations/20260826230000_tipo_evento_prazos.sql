-- Audiências e perícias deixam de depender de palavras no título/descrição.
-- O tipo explícito evita que um mesmo texto apareça nas duas agendas.
ALTER TABLE public.prazos
  ADD COLUMN IF NOT EXISTS tipo_evento text NOT NULL DEFAULT 'prazo'
  CHECK (tipo_evento IN ('prazo', 'audiencia', 'pericia'));

-- Classificação única dos registros existentes: o título tem precedência sobre
-- a descrição, pois a descrição pode mencionar uma audiência relacionada.
UPDATE public.prazos
SET tipo_evento = CASE
  WHEN lower(titulo) LIKE '%perícia%' OR lower(titulo) LIKE '%pericia%' THEN 'pericia'
  WHEN lower(titulo) LIKE '%audiência%' OR lower(titulo) LIKE '%audiencia%' THEN 'audiencia'
  WHEN lower(coalesce(descricao, '')) LIKE '%perícia%'
    OR lower(coalesce(descricao, '')) LIKE '%pericia%' THEN 'pericia'
  WHEN lower(coalesce(descricao, '')) LIKE '%audiência%'
    OR lower(coalesce(descricao, '')) LIKE '%audiencia%' THEN 'audiencia'
  ELSE 'prazo'
END;

CREATE INDEX IF NOT EXISTS idx_prazos_tipo_evento_data
  ON public.prazos (tipo_evento, data_prazo);
