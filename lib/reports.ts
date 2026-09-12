// Shared attendance-report engine: aggregation, scoring, dense ranking.

export type Status = "P" | "P1" | "P2" | "AB";
export type ActivityKey = "pooja" | "ma" | "gdc" | "ekant" | "sa" | "ss" | "sabha" | "lib";

export const ACTIVITIES: { key: ActivityKey; label: string; twoState: boolean; tint: string }[] = [
  { key: "pooja", label: "Pooja", twoState: true, tint: "bg-sched-pooja" },
  { key: "ma", label: "M.A.", twoState: true, tint: "bg-sched-ma" },
  { key: "gdc", label: "G.D.C.", twoState: false, tint: "bg-sched-gdc" },
  { key: "ekant", label: "Ekant", twoState: false, tint: "bg-sched-ekant" },
  { key: "sa", label: "S.A.", twoState: true, tint: "bg-sched-sa" },
  { key: "ss", label: "S.S.", twoState: false, tint: "bg-sched-ss" },
  { key: "sabha", label: "Sabha", twoState: false, tint: "bg-sched-sabha" },
  { key: "lib", label: "Lib.", twoState: false, tint: "bg-sched-lib" },
];

export const STATUSES: Status[] = ["P", "P1", "P2", "AB"];
export const SCORE: Record<Status, number> = { P: 1, P1: 0.75, P2: 0.5, AB: 0 };

/** Per-status shade strength inside a schedule's colour family (P darkest → AB lightest). */
export const TINT_WEIGHT: Record<Status, number> = { P: 100, P1: 78, P2: 58, AB: 36 };

export function statesOf(a: ActivityKey): Status[] {
  return ACTIVITIES.find((x) => x.key === a)!.twoState ? ["P", "AB"] : ["P", "P1", "P2", "AB"];
}

export type Student = {
  id: string;
  enrollment_no: string;
  name: string;
  standard: string;
};

export type AttendanceRow = {
  student_id: string;
  attendance_date: string;
} & Partial<Record<ActivityKey, Status | null>>;

export type SlipRow = {
  student_id: string;
  attendance_date: string;
  activity: string;
  source: string;
};

export type Counts = Record<ActivityKey, Record<Status, number>>;

export type ReportRow = {
  rank: number;
  student: Student;
  groupName: string;
  counts: Counts;
  totals: Record<Status, number>;
  totalSchedule: number;
  score: number;
  pct: number;
  slips: number;
};

function emptyCounts(): Counts {
  const c = {} as Counts;
  ACTIVITIES.forEach((a) => (c[a.key] = { P: 0, P1: 0, P2: 0, AB: 0 }));
  return c;
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Two-state schedules never keep P1/P2 — they are shown and counted as P. */
export function normalizeStatus(a: ActivityKey, s: Status | null | undefined): Status {
  const twoState = ACTIVITIES.find((x) => x.key === a)!.twoState;
  if (!s) return "AB";
  if (twoState && (s === "P1" || s === "P2")) return "P";
  return s;
}

export function buildRows(opts: {
  students: Student[];
  attendance: AttendanceRow[];
  slips: SlipRow[];
  from: string;
  to: string;
  groupOf: (studentId: string) => string;
}): ReportRow[] {
  const { students, attendance, slips, from, to, groupOf } = opts;
  const days = datesBetween(from, to);
  const dayCount = days.length;

  // last entry wins for duplicate student+date
  const latest = new Map<string, AttendanceRow>();
  attendance.forEach((r) => latest.set(`${r.student_id}|${r.attendance_date}`, r));

  const slipKeys = new Map<string, Set<string>>();
  slips.forEach((s) => {
    if (s.attendance_date < from || s.attendance_date > to) return;
    const set = slipKeys.get(s.student_id) ?? new Set<string>();
    set.add(`${s.attendance_date}|${s.activity}|${s.source}`);
    slipKeys.set(s.student_id, set);
  });

  const rows: ReportRow[] = students.map((student) => {
    const counts = emptyCounts();
    days.forEach((day) => {
      const rec = latest.get(`${student.id}|${day}`);
      ACTIVITIES.forEach((a) => {
        const st = normalizeStatus(a.key, rec?.[a.key] ?? null);
        counts[a.key][st] += 1;
      });
    });
    const totals: Record<Status, number> = { P: 0, P1: 0, P2: 0, AB: 0 };
    ACTIVITIES.forEach((a) => STATUSES.forEach((s) => (totals[s] += counts[a.key][s])));
    const totalSchedule = ACTIVITIES.length * dayCount;
    const score = totals.P * SCORE.P + totals.P1 * SCORE.P1 + totals.P2 * SCORE.P2;
    const pct = totalSchedule ? (score * 100) / totalSchedule : 0;
    return {
      rank: 0,
      student,
      groupName: groupOf(student.id),
      counts,
      totals,
      totalSchedule,
      score,
      pct,
      slips: slipKeys.get(student.id)?.size ?? 0,
    };
  });

  return denseRank(rows, (r) => r.pct, (r) => r.student.name);
}

/** Dense rank descending on value; ties share a rank and break on the label. */
export function denseRank<T>(rows: T[], value: (r: T) => number, label: (r: T) => string): T[] {
  const sorted = [...rows].sort((a, b) => value(b) - value(a) || label(a).localeCompare(label(b)));
  let rank = 0;
  let prev: number | null = null;
  sorted.forEach((r) => {
    const v = round2(value(r));
    if (prev === null || v !== prev) {
      rank += 1;
      prev = v;
    }
    (r as any).rank = rank;
  });
  return sorted;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function fmtPct(n: number) {
  return `${n.toFixed(2)}%`;
}

export type GroupSummaryRow = {
  rank: number;
  groupId: string;
  groupName: string;
  leaderName: string;
  memberCount: number;
  counts: Counts;
  totals: Record<Status, number>;
  totalSchedule: number;
  score: number;
  pct: number;
  slips: number;
};

export function buildGroupRows(
  rows: ReportRow[],
  groups: { id: string; name: string; leaderName: string; memberIds: string[] }[],
): GroupSummaryRow[] {
  const byStudent = new Map(rows.map((r) => [r.student.id, r]));
  const out: GroupSummaryRow[] = groups.map((g) => {
    const counts = emptyCounts();
    const totals: Record<Status, number> = { P: 0, P1: 0, P2: 0, AB: 0 };
    let totalSchedule = 0;
    let score = 0;
    let slips = 0;
    let members = 0;
    g.memberIds.forEach((id) => {
      const r = byStudent.get(id);
      if (!r) return;
      members += 1;
      ACTIVITIES.forEach((a) => STATUSES.forEach((s) => (counts[a.key][s] += r.counts[a.key][s])));
      STATUSES.forEach((s) => (totals[s] += r.totals[s]));
      totalSchedule += r.totalSchedule;
      score += r.score;
      slips += r.slips;
    });
    return {
      rank: 0,
      groupId: g.id,
      groupName: g.name,
      leaderName: g.leaderName,
      memberCount: members,
      counts,
      totals,
      totalSchedule,
      score,
      pct: totalSchedule ? (score * 100) / totalSchedule : 0,
      slips,
    };
  });
  return denseRank(out, (r) => r.pct, (r) => r.leaderName);
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Dec Day 1 = 1–10, Dec Day 2 = 11–20, Dec Day 3 = 21–end of month. */
export function decDayRange(month: string, day: 1 | 2 | 3): { from: string; to: string } {
  const { to: monthEnd } = monthRange(month);
  if (day === 1) return { from: `${month}-01`, to: `${month}-10` };
  if (day === 2) return { from: `${month}-11`, to: `${month}-20` };
  return { from: `${month}-21`, to: monthEnd };
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
