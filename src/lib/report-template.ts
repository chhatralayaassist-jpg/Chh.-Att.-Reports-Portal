// Fill the uploaded Excel format (Monthly / Dec Day 1..3) with attendance data
// and download it. Preserves original styling by mutating a template workbook.

export type Status = "P" | "P1" | "P2" | "AB";
export type ActivityKey = "pooja" | "ma" | "gdc" | "ekant" | "sa" | "ss" | "sabha" | "lib";

export type StudentInput = {
  id: string;
  name: string;
  enrollment_no?: string;
  group_name?: string | null;
};

export type AttendanceRecord = Partial<Record<ActivityKey, Status | null>>;

export type ReportSheet = "Monthly" | "Dec Day 1" | "Dec Day 2" | "Dec Day 3";

// Column indices (1-based) in the template
const COLS: Record<ActivityKey | "total", Partial<Record<Status, number>>> = {
  pooja: { P: 5, AB: 6 },
  ma: { P: 7, AB: 8 },
  gdc: { P: 9, P1: 10, P2: 11, AB: 12 },
  ekant: { P: 13, P1: 14, P2: 15, AB: 16 },
  sa: { P: 17, AB: 18 },
  ss: { P: 19, P1: 20, P2: 21, AB: 22 },
  sabha: { P: 23, P1: 24, P2: 25, AB: 26 },
  lib: { P: 27, P1: 28, P2: 29, AB: 30 },
  total: { P: 31, P1: 32, P2: 33, AB: 34 },
};
const COL_SR = 1;
const COL_NAME = 3;
const COL_PCT = 35;
const COL_RANK = 36;
const DATA_START_ROW = 4;

const ACTIVITIES: ActivityKey[] = ["pooja", "ma", "gdc", "ekant", "sa", "ss", "sabha", "lib"];
const SCORE: Record<Status, number> = { P: 1, P1: 0.75, P2: 0.5, AB: 0 };

export type FilledRow = {
  sr: number;
  student: StudentInput;
  counts: Record<ActivityKey, Partial<Record<Status, number>>>;
  totals: Record<Status, number>;
  marked: number;
  score: number;
  pct: number;
};

/**
 * Aggregate per-student counts from a set of attendance rows.
 * For a single date, each cell will be 0 or 1.
 */
export function aggregate(
  students: StudentInput[],
  records: Array<{ student_id: string } & AttendanceRecord>,
): FilledRow[] {
  const perStudent = new Map<string, FilledRow>();
  students.forEach((s, i) => {
    const counts = {} as Record<ActivityKey, Partial<Record<Status, number>>>;
    ACTIVITIES.forEach((a) => (counts[a] = {}));
    perStudent.set(s.id, {
      sr: i + 1,
      student: s,
      counts,
      totals: { P: 0, P1: 0, P2: 0, AB: 0 },
      marked: 0,
      score: 0,
      pct: 0,
    });
  });

  const recordsByStudent = new Map<string, Array<{ student_id: string } & AttendanceRecord>>();
  records.forEach((r) => {
    const arr = recordsByStudent.get(r.student_id) ?? [];
    arr.push(r);
    recordsByStudent.set(r.student_id, arr);
  });

  perStudent.forEach((row, sid) => {
    const recs = recordsByStudent.get(sid) ?? [{ student_id: sid } as any];
    const list = recs.length > 0 ? recs : [{ student_id: sid } as any];
    list.forEach((r) => {
      ACTIVITIES.forEach((a) => {
        const v = ((r[a] as Status | null | undefined) ?? "AB") as Status;
        row.counts[a][v] = (row.counts[a][v] ?? 0) + 1;
        row.totals[v] += 1;
        row.marked += 1;
        row.score += SCORE[v] ?? 0;
      });
    });
  });

  const rows = Array.from(perStudent.values());
  rows.forEach((r) => (r.pct = r.marked > 0 ? (r.score / r.marked) * 100 : 0));
  return rows;
}

async function loadTemplate(): Promise<ArrayBuffer> {
  const res = await fetch("/templates/attendance-format.xlsx");
  if (!res.ok) throw new Error("Failed to load template");
  return await res.arrayBuffer();
}

export async function generateReport(opts: {
  sheet: ReportSheet;
  title?: string;
  headerLabel?: string; // e.g. "Date: 2026-07-02" or "Month: July 2026"
  rows: FilledRow[];
  fileName: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const buf = await loadTemplate();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.getWorksheet(opts.sheet);
  if (!ws) throw new Error(`Sheet ${opts.sheet} not found`);

  if (opts.title) {
    const titleCell = ws.getCell(1, 4);
    titleCell.value = opts.title;
  }
  if (opts.headerLabel) {
    ws.getCell(2, 31).value = opts.headerLabel;
  }

  // Rank the rows by pct desc for ranking column
  const rankMap = new Map<string, number>();
  [...opts.rows]
    .sort((a, b) => b.pct - a.pct || b.score - a.score)
    .forEach((r, i) => rankMap.set(r.student.id, i + 1));

  opts.rows.forEach((r, i) => {
    const rowNum = DATA_START_ROW + i;
    ws.getCell(rowNum, COL_SR).value = i + 1;
    ws.getCell(rowNum, COL_NAME).value = r.student.name;
    ACTIVITIES.forEach((a) => {
      const map = COLS[a];
      (Object.keys(map) as Status[]).forEach((st) => {
        const col = map[st];
        if (col) {
          const n = r.counts[a][st] ?? 0;
          ws.getCell(rowNum, col).value = n === 0 ? null : n;
        }
      });
    });
    // totals
    (Object.keys(COLS.total) as Status[]).forEach((st) => {
      const col = COLS.total[st]!;
      const n = r.totals[st] ?? 0;
      ws.getCell(rowNum, col).value = n === 0 ? null : n;
    });
    ws.getCell(rowNum, COL_PCT).value = r.marked > 0 ? Number(r.pct.toFixed(1)) / 100 : null;
    ws.getCell(rowNum, COL_RANK).value = rankMap.get(r.student.id) ?? null;
  });

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  a.click();
  URL.revokeObjectURL(url);
}
