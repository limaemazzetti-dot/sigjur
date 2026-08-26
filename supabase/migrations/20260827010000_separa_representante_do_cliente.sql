-- Cliente principal e representante são papéis diferentes. Manter campos
-- separados evita que a escolha de um representante substitua o cliente do processo.
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS representante_id uuid
  REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processos_representante_id
  ON public.processos(representante_id);

-- Migra somente casos inequívocos legados: quando o cliente salvo no processo
-- é diferente do autor e já possui vínculo cadastrado com ele.
UPDATE public.processos processo
SET representante_id = processo.cliente_id
FROM public.clientes autor
WHERE processo.representante_id IS NULL
  AND processo.cliente_id IS NOT NULL
  AND processo.cliente_id <> autor.id
  AND lower(trim(processo.autor)) = lower(trim(autor.nome))
  AND EXISTS (
    SELECT 1
    FROM public.cliente_vinculos vinculo
    WHERE (
      vinculo.cliente_principal_id = autor.id
      AND vinculo.cliente_vinculado_id = processo.cliente_id
    ) OR (
      vinculo.cliente_vinculado_id = autor.id
      AND vinculo.cliente_principal_id = processo.cliente_id
    )
  );
