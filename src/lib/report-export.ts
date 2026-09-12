// Excel (ExcelJS) + PDF (jsPDF/autotable) exports that mirror the printed
// "Attendance Summary" sheet layout.
import { ACTIVITIES, STATUSES, TINT_WEIGHT, statesOf, type ReportRow, type GroupSummaryRow } from "@/lib/reports";

const TINT_RGB: Record<string, [number, number, number]> = {
  pooja: [217, 242, 227],
  ma: [217, 230, 247],
  gdc: [251, 231, 208],
  ekant: [232, 220, 247],
  sa: [213, 238, 242],
  ss: [248, 218, 218],
  sabha: [252, 239, 203],
  lib: [217, 242, 232],
  total: [220, 230, 247],
};

/** Lighten a base tint toward white by the status weight (P darkest → AB lightest). */
function shade(rgb: [number, number, number], status: string): [number, number, number] {
  const w = (TINT_WEIGHT[status as keyof typeof TINT_WEIGHT] ?? 100) / 100;
  return rgb.map((c) => Math.round(255 - (255 - c) * w)) as [number, number, number];
}

function shadeHex(key: string, status: string) {
  const [r, g, b] = shade(TINT_RGB[key], status);
  return "FF" + [r, g, b].map((c) => c.toString(16).padStart(2, "0").toUpperCase()).join("");
}

export type ExportKind = "students" | "groups";

type Flat = {
  label: string;
  values: (string | number)[];
};

/** Column layout shared by the screen table and both exports. */
export function headerGroups() {
  const groups: { label: string; keys: string[]; tintKey: string }[] = ACTIVITIES.map((a) => ({
    label: a.label,
    keys: statesOf(a.key),
    tintKey: a.key,
  }));
  groups.push({ label: "Total", keys: [...STATUSES], tintKey: "total" });
  return groups;
}

function studentCells(r: ReportRow): (string | number)[] {
  const cells: (string | number)[] = [];
  ACTIVITIES.forEach((a) => statesOf(a.key).forEach((s) => cells.push(r.counts[a.key][s])));
  STATUSES.forEach((s) => cells.push(r.totals[s]));
  return cells;
}

function groupCells(r: GroupSummaryRow): (string | number)[] {
  const cells: (string | number)[] = [];
  ACTIVITIES.forEach((a) => statesOf(a.key).forEach((s) => cells.push(r.counts[a.key][s])));
  STATUSES.forEach((s) => cells.push(r.totals[s]));
  return cells;
}

export function flattenStudents(rows: ReportRow[]): Flat[] {
  return rows.map((r, i) => ({
    label: r.student.name,
    values: [
      i + 1,
      r.student.name,
      r.student.enrollment_no,
      r.student.standard,
      ...studentCells(r),
      `${r.pct.toFixed(2)}%`,
      r.rank,
      r.slips,
    ],
  }));
}

export function flattenGroups(rows: GroupSummaryRow[]): Flat[] {
  return rows.map((r, i) => ({
    label: r.leaderName,
    values: [
      i + 1,
      r.leaderName,
      String(r.memberCount),
      r.groupName,
      ...groupCells(r),
      `${r.pct.toFixed(2)}%`,
      r.rank,
      r.slips,
    ],
  }));
}

function leadHeaders(kind: ExportKind) {
  return kind === "students" ? ["Sr.no", "Name", "Enrollment", "Standard"] : ["Sr.no", "Name", "Members", "Group"];
}

const TAIL_HEADERS = ["Atte. %", "Rank", "Slips Attendance"];

export async function exportExcel(opts: {
  title: string;
  subtitle: string;
  filename: string;
  kind: ExportKind;
  rows: Flat[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.title.slice(0, 30));

  const lead = leadHeaders(opts.kind);
  const groups = headerGroups();
  const totalCols = lead.length + groups.reduce((n, g) => n + g.keys.length, 0) + TAIL_HEADERS.length;

  const titleRow = ws.addRow([opts.title]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.font = { bold: true, size: 14 };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 24;

  const subRow = ws.addRow([opts.subtitle]);
  ws.mergeCells(2, 1, 2, totalCols);
  subRow.alignment = { horizontal: "right" };

  // two-line header
  const h1: string[] = [...lead.map(() => "")];
  const h2: string[] = [...lead];
  groups.forEach((g) => {
    g.keys.forEach((k, i) => {
      h1.push(i === 0 ? g.label : "");
      h2.push(k);
    });
  });
  TAIL_HEADERS.forEach((t) => {
    h1.push("");
    h2.push(t);
  });

  const r1 = ws.addRow(h1);
  const r2 = ws.addRow(h2);
  const headTop = r1.number;

  // merge lead + tail vertically, schedule labels horizontally
  lead.forEach((_, i) => ws.mergeCells(headTop, i + 1, headTop + 1, i + 1));
  let col = lead.length + 1;
  groups.forEach((g) => {
    ws.mergeCells(headTop, col, headTop, col + g.keys.length - 1);
    col += g.keys.length;
  });
  TAIL_HEADERS.forEach((_, i) => ws.mergeCells(headTop, col + i, headTop + 1, col + i));

  [r1, r2].forEach((row) => {
    row.font = { bold: true };
    row.alignment = { horizontal: "center", vertical: "middle" };
  });

  opts.rows.forEach((r) => ws.addRow(r.values));

  // borders + tints
  const lastRow = ws.rowCount;
  for (let rn = headTop; rn <= lastRow; rn++) {
    for (let cn = 1; cn <= totalCols; cn++) {
      const cell = ws.getCell(rn, cn);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (cn > lead.length) cell.alignment = { horizontal: "center" };
    }
  }
  let c = lead.length + 1;
  groups.forEach((g) => {
    for (let i = 0; i < g.keys.length; i++) {
      const hex = shadeHex(g.tintKey, g.keys[i]);
      for (let rn = headTop; rn <= lastRow; rn++) {
        ws.getCell(rn, c + i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: hex } };
      }
    }
    c += g.keys.length;
  });

  ws.getColumn(1).width = 7;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 12;
  for (let i = lead.length + 1; i <= totalCols; i++) ws.getColumn(i).width = 6;
  ws.getColumn(totalCols).width = 16;
  ws.getColumn(totalCols - 2).width = 10;
  ws.views = [{ state: "frozen", ySplit: headTop + 1 }];

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${opts.filename}.xlsx`);
}

export async function exportPDF(opts: {
  title: string;
  subtitle: string;
  filename: string;
  kind: ExportKind;
  rows: Flat[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
  const lead = leadHeaders(opts.kind);
  const groups = headerGroups();

  doc.setFontSize(14);
  doc.text(opts.title, doc.internal.pageSize.getWidth() / 2, 30, { align: "center" });
  doc.setFontSize(10);
  doc.text(opts.subtitle, doc.internal.pageSize.getWidth() - 30, 46, { align: "right" });

  const head1: any[] = lead.map((l) => ({ content: l, rowSpan: 2 }));
  groups.forEach((g) => head1.push({ content: g.label, colSpan: g.keys.length }));
  TAIL_HEADERS.forEach((t) => head1.push({ content: t, rowSpan: 2 }));
  const head2: any[] = [];
  groups.forEach((g) => g.keys.forEach((k) => head2.push(k)));

  const columnStyles: Record<number, any> = {};
  let idx = lead.length;
  groups.forEach((g) => {
    for (let i = 0; i < g.keys.length; i++) {
      columnStyles[idx + i] = { fillColor: shade(TINT_RGB[g.tintKey], g.keys[i]), halign: "center", cellWidth: 22 };
    }
    idx += g.keys.length;
  });
  columnStyles[1] = { cellWidth: 140 };

  autoTable(doc, {
    startY: 56,
    head: [head1, head2],
    body: opts.rows.map((r) => r.values as any),
    styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.4, lineColor: [120, 120, 120] },
    headStyles: { fillColor: [235, 238, 245], textColor: [20, 20, 20], halign: "center", lineWidth: 0.4 },
    columnStyles,
    theme: "grid",
  });

  doc.save(`${opts.filename}.pdf`);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
