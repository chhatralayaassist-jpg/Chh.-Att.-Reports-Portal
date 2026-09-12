DROP POLICY IF EXISTS "public read attendance" ON public.attendance;
DROP POLICY IF EXISTS "read attendance" ON public.attendance;
DROP POLICY IF EXISTS "public read attendance_slips" ON public.attendance_slips;
DROP POLICY IF EXISTS "read attendance_slips" ON public.attendance_slips;
DROP POLICY IF EXISTS "public read leave_slips" ON public.leave_slips;
DROP POLICY IF EXISTS "read leave_slips" ON public.leave_slips;
DROP POLICY IF EXISTS "read slips_attendance" ON public.slips_attendance;
DROP POLICY IF EXISTS "public read students" ON public.students;
DROP POLICY IF EXISTS "read students" ON public.students;

REVOKE ALL ON public.attendance FROM anon;
REVOKE ALL ON public.attendance_slips FROM anon;
REVOKE ALL ON public.leave_slips FROM anon;
REVOKE ALL ON public.slips_attendance FROM anon;
REVOKE ALL ON public.students FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_slips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_slips TO authenticated;
GRANT SELECT ON public.slips_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.attendance TO service_role;
GRANT ALL ON public.attendance_slips TO service_role;
GRANT ALL ON public.leave_slips TO service_role;
GRANT ALL ON public.slips_attendance TO service_role;
GRANT ALL ON public.students TO service_role;