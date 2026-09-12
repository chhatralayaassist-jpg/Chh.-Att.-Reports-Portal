CREATE TABLE public.gate_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  pass_date date NOT NULL,
  student_ids uuid[] NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  duration text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decline_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate_passes TO authenticated;
GRANT ALL ON public.gate_passes TO service_role;

ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gate_passes_select_own_or_reviewer" ON public.gate_passes FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rector'));

CREATE POLICY "gate_passes_insert_own" ON public.gate_passes FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'group_leader')));

CREATE POLICY "gate_passes_update_own_pending" ON public.gate_passes FOR UPDATE TO authenticated
USING (requested_by = auth.uid() AND status = 'pending') WITH CHECK (requested_by = auth.uid());

CREATE POLICY "gate_passes_update_reviewer" ON public.gate_passes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rector'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rector'));

CREATE POLICY "gate_passes_delete" ON public.gate_passes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR (requested_by = auth.uid() AND status = 'pending'));

CREATE TRIGGER trg_gate_passes_updated BEFORE UPDATE ON public.gate_passes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();