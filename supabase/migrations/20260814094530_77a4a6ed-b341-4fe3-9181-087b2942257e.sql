CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  file_url text,
  file_name text,
  recipient_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notices" ON public.notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read their notices" ON public.notices FOR SELECT TO authenticated
  USING (cardinality(recipient_ids) = 0 OR auth.uid() = ANY (recipient_ids));

CREATE TRIGGER trg_notices_updated BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Signed in users read notice files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notice-files');

CREATE POLICY "Admins upload notice files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notice-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update notice files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'notice-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete notice files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notice-files' AND public.has_role(auth.uid(), 'admin'));