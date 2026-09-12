export const ACTIVITIES = [
  { key: "pooja", label: "Pooja" },
  { key: "ma", label: "M.A." },
  { key: "gdc", label: "G.D.C." },
  { key: "ekant", label: "Ekant" },
  { key: "sa", label: "S.A." },
  { key: "ss", label: "S.S." },
  { key: "sabha", label: "Sabha" },
  { key: "lib", label: "Lib." },
] as const;

export type ActivityKey = (typeof ACTIVITIES)[number]["key"];

export type SlipRow = {
  id: string;
  requested_by: string;
  date_from: string;
  date_to: string;
  student_ids: string[];
  activities: string[];
  reason: string;
  status: string;
  decline_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type LeaveSlipRow = {
  id: string;
  requested_by: string;
  student_id: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: string;
  decline_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  permitted_by: string[] | null;
  return_date: string | null;
  return_submitted_at: string | null;
  late_days: number | null;
  late_fine: number | null;
  late_message: string | null;
  leave_time: string | null;
  decided_return_time: string | null;
  return_time: string | null;
};

export function fmtTime(t?: string | null): string {
  if (!t) return "-";
  return t.slice(0, 5);
}


/** Whole days late only: each complete day after the decided end date counts. */
export function computeLate(dateTo: string, returnDate: string, ratePerDay: number) {
  const end = new Date(dateTo + "T00:00:00").getTime();
  const back = new Date(returnDate + "T00:00:00").getTime();
  if (Number.isNaN(end) || Number.isNaN(back)) return { days: 0, fine: 0 };
  const days = Math.max(0, Math.floor((back - end) / 86400000));
  return { days, fine: days * ratePerDay };
}

export function lateMessage(days: number, fine: number) {
  if (days <= 0) return "Returned on time — no fine.";
  return `Returned ${days} day${days > 1 ? "s" : ""} late. Fine: ₹${fine}.`;
}



const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayFromDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "-";
  return DAYS[d.getDay()]!;
}

export function fmtDate(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from) return out;
  const d = new Date(from + "T00:00:00");
  const end = new Date((to || from) + "T00:00:00");
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return out;
  while (d <= end) {
    out.push(toLocalISO(d));
    if (out.length > 366) break;
    d.setDate(d.getDate() + 1);
  }
  return out;
}
