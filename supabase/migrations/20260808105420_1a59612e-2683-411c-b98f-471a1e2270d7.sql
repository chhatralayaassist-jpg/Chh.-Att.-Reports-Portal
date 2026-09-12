ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS remark text;

ALTER TABLE public.leave_slips
  ADD COLUMN IF NOT EXISTS permitted_by text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS return_date date,
  ADD COLUMN IF NOT EXISTS return_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_days integer,
  ADD COLUMN IF NOT EXISTS late_fine integer,
  ADD COLUMN IF NOT EXISTS late_message text;

CREATE TABLE IF NOT EXISTS public.permitters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permitters TO authenticated;
GRANT ALL ON public.permitters TO service_role;
ALTER TABLE public.permitters ENABLE ROW LEVEL SECURITY;
CREATE POLICY permitters_select_auth ON public.permitters FOR SELECT TO authenticated USING (true);
CREATE POLICY permitters_admin_all ON public.permitters FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_permitters_updated BEFORE UPDATE ON public.permitters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_select_auth ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY app_settings_admin_all ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value) VALUES ('late_fine_per_day', '100')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO public.permitters (name) VALUES ('Rector'), ('Principal'), ('Parent')
  ON CONFLICT (name) DO NOTHING;