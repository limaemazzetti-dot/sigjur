
CREATE TABLE public.sync_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL CHECK (modulo IN ('painel','processos','clientes','lancamentos','dre')),
  label text NOT NULL,
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL,
  ano int,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_mappings TO authenticated;
GRANT ALL ON public.sync_mappings TO service_role;

ALTER TABLE public.sync_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage own sync mappings"
  ON public.sync_mappings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));

CREATE TRIGGER sync_mappings_updated_at
  BEFORE UPDATE ON public.sync_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
