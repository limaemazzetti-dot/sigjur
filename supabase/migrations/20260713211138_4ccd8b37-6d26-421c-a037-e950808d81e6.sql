
CREATE TABLE public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page)
);
GRANT SELECT ON public.user_page_permissions TO authenticated;
GRANT ALL ON public.user_page_permissions TO service_role;
ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permissions"
ON public.user_page_permissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
