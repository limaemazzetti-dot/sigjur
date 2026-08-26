-- Origem passa a ser uma opção padronizada e autores/réus suportam múltiplas partes.
-- As colunas text antigas continuam como resumo compatível com relatórios legados.
ALTER TABLE public.catalogo_opcoes
  DROP CONSTRAINT IF EXISTS catalogo_opcoes_categoria_check;

ALTER TABLE public.catalogo_opcoes
  ADD CONSTRAINT catalogo_opcoes_categoria_check
  CHECK (categoria IN ('tipo_acao', 'materia', 'fase', 'advogado', 'origem'));

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS autores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reus jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.processos
SET autores = jsonb_build_array(autor)
WHERE jsonb_array_length(autores) = 0 AND nullif(trim(autor), '') IS NOT NULL;

UPDATE public.processos
SET reus = jsonb_build_array(reu)
WHERE jsonb_array_length(reus) = 0 AND nullif(trim(reu), '') IS NOT NULL;
