
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS parcela_num INTEGER,
  ADD COLUMN IF NOT EXISTS parcela_total INTEGER,
  ADD COLUMN IF NOT EXISTS parcela_grupo_id UUID,
  ADD COLUMN IF NOT EXISTS juros_percentual NUMERIC(6,3);
