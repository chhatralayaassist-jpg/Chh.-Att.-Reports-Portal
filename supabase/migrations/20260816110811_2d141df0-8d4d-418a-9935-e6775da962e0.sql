DROP POLICY IF EXISTS "public read attendance" ON public.attendance;
DROP POLICY IF EXISTS "public read students" ON public.students;
REVOKE ALL ON public.attendance FROM anon;
REVOKE ALL ON public.students FROM anon;