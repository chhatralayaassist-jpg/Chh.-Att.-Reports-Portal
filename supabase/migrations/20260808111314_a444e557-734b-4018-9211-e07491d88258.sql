ALTER TABLE public.leave_slips
  ADD COLUMN IF NOT EXISTS leave_time text,
  ADD COLUMN IF NOT EXISTS decided_return_time text,
  ADD COLUMN IF NOT EXISTS return_time text;