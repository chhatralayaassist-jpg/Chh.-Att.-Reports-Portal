CREATE TABLE public.report_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  leader_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leader_student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_groups TO authenticated;
GRANT ALL ON public.report_groups TO service_role;
ALTER TABLE public.report_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_groups_read" ON public.report_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "report_groups_admin_write" ON public.report_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_report_groups_updated BEFORE UPDATE ON public.report_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.report_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.report_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_group_members TO authenticated;
GRANT ALL ON public.report_group_members TO service_role;
ALTER TABLE public.report_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_group_members_read" ON public.report_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "report_group_members_admin_write" ON public.report_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));