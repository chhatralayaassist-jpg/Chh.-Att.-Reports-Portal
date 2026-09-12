-- Remove anonymous read access to students and attendance
DROP POLICY IF EXISTS "students_select_public" ON public.students;
DROP POLICY IF EXISTS "attendance_select_public" ON public.attendance;
REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.attendance FROM anon;

-- Make sure staff can still read students
DROP POLICY IF EXISTS "students_select_staff" ON public.students;
CREATE POLICY "students_select_staff" ON public.students
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'attendance_taker')
  OR public.has_role(auth.uid(),'rector') OR public.has_role(auth.uid(),'group_leader')
);

-- Prevent spoofing approval fields when creating slips
DROP POLICY IF EXISTS "slips_insert_staff" ON public.attendance_slips;
CREATE POLICY "slips_insert_staff" ON public.attendance_slips
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rector') OR public.has_role(auth.uid(),'group_leader'))
  AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL
);

DROP POLICY IF EXISTS "leave_insert_staff" ON public.leave_slips;
CREATE POLICY "leave_insert_staff" ON public.leave_slips
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'group_leader'))
  AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL
);

-- OAuth tokens table: server-side only
DROP POLICY IF EXISTS "sheets_own" ON public.sheets_connections;
CREATE POLICY "sheets_no_client_access" ON public.sheets_connections
FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
REVOKE ALL ON public.sheets_connections FROM anon, authenticated;
GRANT ALL ON public.sheets_connections TO service_role;

-- Security definer functions should not be callable by clients that don't need them
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_my_roles() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated;