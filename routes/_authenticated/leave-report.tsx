import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { dayFromDate, fmtDate, type LeaveSlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/leave-report")({
  head: () => ({
    meta: [
      { title: "Monthly Leave Report — Chhatralaya Attendance" },
      { name: "description", content: "Month-wise leave report of every student with dates, days and total days of leave." },
      { property: "og:title", content: "Monthly Leave Report — Chhatralaya Attendance" },
      { property: "og:description", content: "Month-wise leave report of every student with dates, days and total days of leave." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Monthly Leave Report — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Month-wise leave report of every student with dates, days and total days of leave." },
    ],
  }),
  component: LeaveReportPage,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Student = { id: string; enrollment_no: string; name: string };

function dayCount(from: string, to: string) {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

function LeaveReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: students = [] } = useQuery({
    queryKey: ["students-leave-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, enrollment_no, name").order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const { data: slips = [] } = useQuery({
    queryKey: ["leave-report", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_slips")
        .select("*")
        .eq("status", "approved")
        .lte("date_from", monthEnd)
        .order("date_from");
      if (error) throw error;
      return (data ?? []) as LeaveSlipRow[];
    },
  });

  const nameById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const rows = useMemo(() => {
    return slips
      .map((s) => {
        const end = s.return_date && s.return_date > s.date_to ? s.return_date : s.date_to;
        const from = s.date_from > monthStart ? s.date_from : monthStart;
        const to = end < monthEnd ? end : monthEnd;
        const total = dayCount(from, to);
        return { slip: s, from, to, total };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.from.localeCompare(b.from));
  }, [slips, monthStart, monthEnd]);

  const header = ["No.", "Enrollment", "Name", "Date to Date", "Day to Day", "Total Days of Leave"];

  const bodyRows = () =>
    rows.map((r, i) => [
      i + 1,
      nameById[r.slip.student_id]?.enrollment_no ?? "",
      nameById[r.slip.student_id]?.name ?? r.slip.student_id,
      `${fmtDate(r.from)} to ${fmtDate(r.to)}`,
      `${dayFromDate(r.from)} to ${dayFromDate(r.to)}`,
      r.total,
    ]);

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const lines = [
      [`Chhatralaya Monthly Leave Report`],
      [`Month: ${MONTHS[month]}`, `Year: ${year}`],
      header,
      ...bodyRows().map((r) => r.map(String)),
    ];
    const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    save(new Blob([csv], { type: "text/csv;charset=utf-8" }), `leave-report-${MONTHS[month]}-${year}.csv`);
  };

  const downloadExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Leave Report");
    ws.columns = [
      { width: 6 }, { width: 16 }, { width: 30 }, { width: 30 }, { width: 30 }, { width: 20 },
    ];

    const thin = { style: "thin" as const, color: { argb: "FF000000" } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    ws.mergeCells("A1:F1");
    const t = ws.getCell("A1");
    t.value = "Chhatralaya Monthly Leave Report";
    t.font = { name: "Arial", size: 16, bold: true };
    t.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    ws.mergeCells("A2:C2");
    ws.mergeCells("D2:F2");
    ws.getCell("A2").value = `Month: ${MONTHS[month]}`;
    ws.getCell("D2").value = `Year: ${year}`;
    ["A2", "D2"].forEach((a) => {
      const c = ws.getCell(a);
      c.font = { name: "Arial", bold: true };
      c.alignment = { horizontal: "center" };
      c.border = border;
    });

    const hr = ws.addRow([]);
    hr.values = header;
    hr.eachCell((c) => {
      c.font = { name: "Arial", bold: true };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
      c.border = border;
    });
    hr.height = 22;

    bodyRows().forEach((r) => {
      const row = ws.addRow(r);
      row.eachCell((c, i) => {
        c.font = { name: "Arial" };
        c.alignment = { horizontal: i === 3 ? "left" : "center", vertical: "middle" };
        c.border = border;
      });
    });

    const total = rows.reduce((a, r) => a + r.total, 0);
    const tr = ws.addRow(["", "", "Total", "", "", total]);
    tr.eachCell((c) => {
      c.font = { name: "Arial", bold: true };
      c.alignment = { horizontal: "center" };
      c.border = border;
    });

    const out = await wb.xlsx.writeBuffer();
    save(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `leave-report-${MONTHS[month]}-${year}.xlsx`,
    );
  };

  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Chhatralaya Monthly Leave Report", pageWidth / 2, 40, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Month: ${MONTHS[month]}`, 40, 62);
    doc.text(`Year: ${year}`, pageWidth - 40, 62, { align: "right" });

    const total = rows.reduce((a, r) => a + r.total, 0);
    autoTable(doc, {
      head: [header],
      body: bodyRows().map((r) => r.map(String)),
      foot: [["", "", "Total", "", "", String(total)]],
      startY: 76,
      margin: { left: 40, right: 40 },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 5, lineWidth: 0.8, lineColor: [0, 0, 0], valign: "middle" },
      headStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
      bodyStyles: { halign: "center" },
      columnStyles: { 0: { cellWidth: 40 }, 2: { halign: "left" } },
    });

    doc.save(`leave-report-${MONTHS[month]}-${year}.pdf`);
  };


  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Monthly Leave Report</h1>
        <p className="text-sm text-muted-foreground">Approved leaves for the selected month, in the Chhatralaya format.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chhatralaya Monthly Leave Report</CardTitle>
          <CardDescription>{rows.length} leave entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input
                className="w-28"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
              />
            </div>
            <Button variant="outline" onClick={downloadExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
            </Button>
            <Button variant="outline" onClick={downloadPdf}>
              <FileText className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            <Button variant="ghost" onClick={downloadCsv}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>

          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                  <th>No.</th>
                  <th>Enrollment</th>
                  <th>Name</th>
                  <th>Date to Date</th>
                  <th>Day to Day</th>
                  <th>Total Days of Leave</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={r.slip.id} className="[&>td]:px-3 [&>td]:py-2">
                    <td>{i + 1}</td>
                    <td>{nameById[r.slip.student_id]?.enrollment_no ?? "-"}</td>
                    <td>{nameById[r.slip.student_id]?.name ?? r.slip.student_id}</td>
                    <td>{fmtDate(r.from)} to {fmtDate(r.to)}</td>
                    <td>{dayFromDate(r.from)} to {dayFromDate(r.to)}</td>
                    <td>{r.total}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No approved leave in {MONTHS[month]} {year}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
