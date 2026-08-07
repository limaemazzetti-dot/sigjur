
CREATE TABLE public.backups_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tag text,
  size_bytes integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups_snapshots TO authenticated;
GRANT ALL ON public.backups_snapshots TO service_role;

ALTER TABLE public.backups_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all backups"
  ON public.backups_snapshots FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create backups"
  ON public.backups_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete backups"
  ON public.backups_snapshots FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_backups_snapshots_created_at ON public.backups_snapshots (created_at DESC);
