import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/group-report")({
  head: () => ({
    meta: [
      { title: "Daily Attendance Report — Chhatralaya" },
      { name: "description", content: "Group Leader daily attendance report with date, day and PDF export." },
      { property: "og:title", content: "Daily Attendance Report — Chhatralaya" },
      { property: "og:description", content: "Group Leader daily attendance report with date, day and PDF export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Daily Attendance Report — Chhatralaya" },
      { name: "twitter:description", content: "Group Leader daily attendance report with date, day and PDF export." },
    ],
  }),
  component: GroupReportPage,
});

const ACTIVITIES = [
  { key: "pooja", label: "Pooja" },
  { key: "ma", label: "M.A." },
  { key: "gdc", label: "G.D.C." },
  { key: "ekant", label: "Ekant" },
  { key: "sa", label: "S.A." },
  { key: "ss", label: "S.S." },
  { key: "sabha", label: "Sabha" },
  { key: "lib", label: "Lib." },
] as const;

type Status = "P" | "P1" | "P2" | "AB";

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDMY(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function dayName(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

const cellClass = (s: Status) => {
  switch (s) {
    case "P": return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
    case "P1": return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
    case "P2": return "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100";
    default: return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100";
  }
};

function GroupReportPage() {
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,enrollment_no,name,group_name,standard")
        .order("enrollment_no");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["attendance-day", date],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").eq("attendance_date", date);
      if (error) throw error;
      return data as any[];
    },
  });

  const byStudent = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r) => m.set(r.student_id, r));
    return m;
  }, [rows]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.enrollment_no ?? "").toLowerCase().includes(q) ||
        (s.group_name ?? "").toLowerCase().includes(q) ||
        (s.standard ?? "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const statusOf = (studentId: string, key: string): Status =>
    ((byStudent.get(studentId)?.[key] as Status) ?? "AB");

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(15);
    doc.text("Daily Attendance Report", 40, 40);
    doc.setFontSize(10);
    doc.text(`Date: ${formatDMY(date)}`, 40, 58);
    doc.text(`Day: ${dayName(date)}`, 200, 58);

    autoTable(doc, {
      startY: 72,
      head: [[
        "No.",
        "Enrollment",
        "Name",
        "Group",
        "Std.",
        ...ACTIVITIES.map((a) => a.label),
      ]],
      body: list.map((s, i) => [
        String(i + 1),
        s.enrollment_no ?? "",
        s.name,
        s.group_name ?? "",
        s.standard ?? "",
        ...ACTIVITIES.map((a) => statusOf(s.id, a.key)),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`daily-attendance-${date}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Attendance Report</h1>
          <p className="text-muted-foreground mt-1">Read-only report for group leaders.</p>
        </div>
        <Button onClick={exportPdf}>
          <FileDown className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
          <CardDescription>
            Date: {formatDMY(date)} &middot; Day: {dayName(date)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">Date (DD/MM/YYYY)</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </div>
          <div>
            <Label className="text-xs">Day</Label>
            <Input value={dayName(date)} readOnly className="w-44 bg-muted" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Search (Name, Enrollment, Group, Std.)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, enrollment, group or standard"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{list.length} students</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* Mobile: one card per student, same as Daily Register */}
          <div className="space-y-3 p-3 md:hidden">
            {list.map((s, idx) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{s.group_name} · {s.standard}</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {ACTIVITIES.map((a) => {
                    const v = statusOf(s.id, a.key);
                    return (
                      <div key={a.key} className="text-center">
                        <div className="text-[10px] text-muted-foreground">{a.label}</div>
                        <div className={`mt-1 rounded-md px-1 py-1 text-xs font-semibold ${cellClass(v)}`}>{v}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="py-8 text-center text-muted-foreground">No students found.</p>}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <Table>

            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No.</TableHead>
                <TableHead>Enrollment</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Std.</TableHead>
                {ACTIVITIES.map((a) => (
                  <TableHead key={a.key} className="text-center">{a.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{s.enrollment_no}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.group_name}</TableCell>
                  <TableCell>{s.standard}</TableCell>
                  {ACTIVITIES.map((a) => {
                    const v = statusOf(s.id, a.key);
                    return (
                      <TableCell key={a.key} className={`text-center text-xs font-semibold ${cellClass(v)}`}>
                        {v}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5 + ACTIVITIES.length} className="text-center text-muted-foreground py-8">
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>


      </Card>
    </div>
  );
}
