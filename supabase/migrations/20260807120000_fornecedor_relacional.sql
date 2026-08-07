-- Torna fornecedores uma informação relacional, sem depender de marcadores
-- ocultos em observações ou no campo de referência do processo.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS fornecedor boolean NOT NULL DEFAULT false;

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid
  REFERENCES public.clientes(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_fornecedor_id
  ON public.lancamentos(fornecedor_id);

-- Migra os cadastros criados pela implementação provisória.
UPDATE public.clientes
SET
  fornecedor = true,
  observacoes = NULLIF(
    btrim(replace(COALESCE(observacoes, ''), '[[SIGJUR:FORNECEDOR]]', '')),
    ''
  )
WHERE COALESCE(observacoes, '') LIKE '%[[SIGJUR:FORNECEDOR]]%';

-- Migra o fornecedor que antes ficava codificado em processo_ref.
UPDATE public.lancamentos AS lancamento
SET
  fornecedor_id = substring(
    lancamento.processo_ref
    FROM '^\[\[SIGJUR:FORNECEDOR:([0-9a-fA-F-]{36})\]\]$'
  )::uuid,
  processo_ref = NULL
WHERE lancamento.processo_ref ~
      '^\[\[SIGJUR:FORNECEDOR:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\]\]$'
  AND EXISTS (
    SELECT 1
    FROM public.clientes AS cliente
    WHERE cliente.id = substring(
      lancamento.processo_ref
      FROM '^\[\[SIGJUR:FORNECEDOR:([0-9a-fA-F-]{36})\]\]$'
    )::uuid
  );
