
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nacionalidade text,
  ADD COLUMN IF NOT EXISTS representante_nome text,
  ADD COLUMN IF NOT EXISTS representante_nacionalidade text,
  ADD COLUMN IF NOT EXISTS representante_profissao text,
  ADD COLUMN IF NOT EXISTS representante_data_nascimento date,
  ADD COLUMN IF NOT EXISTS representante_rg text,
  ADD COLUMN IF NOT EXISTS representante_cpf text,
  ADD COLUMN IF NOT EXISTS representante_parentesco text;
