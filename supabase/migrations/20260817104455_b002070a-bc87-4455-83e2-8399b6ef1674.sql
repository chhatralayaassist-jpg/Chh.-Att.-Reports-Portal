CREATE TABLE public.slips_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  activity text NOT NULL,
  source text NOT NULL CHECK (source IN ('attendance_slip','leave_slip')),
  slip_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date, activity, source, slip_id)
);

CREATE INDEX idx_slips_attendance_date ON public.slips_attendance (attendance_date);
CREATE INDEX idx_slips_attendance_student ON public.slips_attendance (student_id);

GRANT SELECT ON public.slips_attendance TO authenticated;
GRANT ALL ON public.slips_attendance TO service_role;

ALTER TABLE public.slips_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in staff can view slips attendance"
ON public.slips_attendance FOR SELECT TO authenticated USING (true);

-- attendance slips sync
CREATE OR REPLACE FUNCTION public.sync_attendance_slip_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acts text[];
  d date;
  a text;
  sid uuid;
BEGIN
  DELETE FROM public.slips_attendance
   WHERE source = 'attendance_slip' AND slip_id = COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'DELETE' OR NEW.status <> 'approved' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  acts := CASE WHEN array_length(NEW.activities, 1) IS NULL
            THEN ARRAY['pooja','ma','gdc','ekant','sa','sabha','lib','ss']
            ELSE NEW.activities END;

  FOREACH sid IN ARRAY NEW.student_ids LOOP
    d := NEW.date_from;
    WHILE d <= NEW.date_to LOOP
      FOREACH a IN ARRAY acts LOOP
        INSERT INTO public.slips_attendance (student_id, attendance_date, activity, source, slip_id)
        VALUES (sid, d, a, 'attendance_slip', NEW.id)
        ON CONFLICT DO NOTHING;
      END LOOP;
      d := d + 1;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_slip_marks
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_slips
FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_slip_marks();

-- leave slips sync
CREATE OR REPLACE FUNCTION public.sync_leave_slip_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  a text;
  end_date date;
BEGIN
  DELETE FROM public.slips_attendance
   WHERE source = 'leave_slip' AND slip_id = COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'DELETE' OR NEW.status <> 'approved' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  end_date := GREATEST(NEW.date_to, COALESCE(NEW.return_date, NEW.date_to));

  d := NEW.date_from;
  WHILE d <= end_date LOOP
    FOREACH a IN ARRAY ARRAY['pooja','ma','gdc','ekant','sa','sabha','lib','ss'] LOOP
      INSERT INTO public.slips_attendance (student_id, attendance_date, activity, source, slip_id)
      VALUES (NEW.student_id, d, a, 'leave_slip', NEW.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    d := d + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_slip_marks
AFTER INSERT OR UPDATE OR DELETE ON public.leave_slips
FOR EACH ROW EXECUTE FUNCTION public.sync_leave_slip_marks();

-- backfill existing approved slips
UPDATE public.attendance_slips SET updated_at = updated_at WHERE status = 'approved';
UPDATE public.leave_slips SET updated_at = updated_at WHERE status = 'approved';