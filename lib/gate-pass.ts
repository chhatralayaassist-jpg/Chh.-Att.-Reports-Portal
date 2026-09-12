export type GatePassRow = {
  id: string;
  requested_by: string;
  pass_date: string;
  student_ids: string[];
  reason: string;
  duration: string;
  status: string;
  decline_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};
