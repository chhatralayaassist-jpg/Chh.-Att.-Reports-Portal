import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, MessageSquare, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const REPORT_NUMBERS = [
  "+919925237010",
  "+916359650013",
  "+919227979540",
  "+918866372988",
  "+919998459378",
];

export const Route = createFileRoute("/_authenticated/daily")({
  head: () => ({
    meta: [
      { title: "Daily Register — Chhatralaya Attendance" },
      { name: "description", content: "View the day's attendance register for every group and share the summary straight to WhatsApp." },
      { property: "og:title", content: "Daily Register — Chhatralaya Attendance" },
      { property: "og:description", content: "View the day's attendance register for every group and share the summary straight to WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Daily Register — Chhatralaya Attendance" },
      { name: "twitter:description", content: "View the day's attendance register for every group and share the summary straight to WhatsApp." },
    ],
  }),
  component: DailyPage,
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

type Status = "P" | "P1" | "P2" | "AB" | null;

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const cellClass = (s: Status) => {
  switch (s) {
    case "P": return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
    case "P1": return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
    case "P2": return "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100";
    case "AB": return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100";
    default: return "text-muted-foreground/60";
  }
};

function DailyPage() {
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [msgOpen, setMsgOpen] = useState(false);
  const { data: myRoles = [] } = useMyRoles();
  const isAdmin = myRoles.includes("admin");
  const [markInfo, setMarkInfo] = useState<
    { student: string; activity: string; status: Status; by: string; at: string | null } | null
  >(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-lookup"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data as any[];
    },
  });


  const { data: students = [] } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id,enrollment_no,name,nickname,group_name,standard").order("enrollment_no");
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

  // Attendance granted by approved slips, stored in the slips_attendance table
  const { data: slipCounts = {} } = useQuery({
    queryKey: ["slip-attendance-count", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slips_attendance")
        .select("student_id, activity")
        .eq("attendance_date", date);
      if (error) throw error;
      const perStudent = new Map<string, Set<string>>();
      (data ?? []).forEach((r: any) => {
        const set = perStudent.get(r.student_id) ?? new Set<string>();
        set.add(r.activity);
        perStudent.set(r.student_id, set);
      });
      return Object.fromEntries([...perStudent].map(([k, v]) => [k, v.size])) as Record<string, number>;
    },
  });


  const byStudent = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r) => m.set(r.student_id, r));
    return m;
  }, [rows]);


  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) =>
      !q || s.name.toLowerCase().includes(q) || s.enrollment_no.toLowerCase().includes(q) || (s.group_name ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  const summary = useMemo(() => {
    let totalCells = 0, p = 0, p1 = 0, p2 = 0, ab = 0, blank = 0;
    students.forEach((s) => {
      const r = byStudent.get(s.id);
      ACTIVITIES.forEach((a) => {
        totalCells++;
        const v: Status = r?.[a.key] ?? null;
        if (v === "P") p++;
        else if (v === "P1") p1++;
        else if (v === "P2") p2++;
        else if (v === "AB") ab++;
        else blank++;
      });
    });
    return { totalCells, p, p1, p2, ab, blank };
  }, [students, byStudent]);

  const exportXlsx = () => {
    const data = list.map((s) => {
      const r = byStudent.get(s.id);
      const row: any = { "Enrollment": s.enrollment_no, "Name": s.name, "Group": s.group_name ?? "", "Standard": s.standard ?? "" };
      ACTIVITIES.forEach((a) => (row[a.label] = r?.[a.key] ?? "AB"));
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, date);
    XLSX.writeFile(wb, `attendance-${date}.xlsx`);
  };

  const printFormat = async () => {
    const { aggregate, generateReport } = await import("@/lib/report-template");
    const filled = aggregate(
      list.map((s) => ({ id: s.id, name: s.name, enrollment_no: s.enrollment_no, group_name: s.group_name })),
      rows.map((r) => ({ student_id: r.student_id, pooja: r.pooja, ma: r.ma, gdc: r.gdc, ekant: r.ekant, sa: r.sa, ss: r.ss, sabha: r.sabha, lib: r.lib })),
    );
    await generateReport({
      sheet: "Monthly",
      title: "Attendance Daily Register",
      headerLabel: `Date: ${date}`,
      rows: filled,
      fileName: `daily-${date}.xlsx`,
    });
  };

  const messageText = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });

    const lines: string[] = [
      "Daily Attendance Report",
      `Date: ${dd}/${mm}/${d.getFullYear()}`,
      `Day: ${dayName}`,
      "Only AB",
      "Schedules:",
    ];

    ACTIVITIES.forEach((a) => {
      const names = students
        .filter((s) => ((byStudent.get(s.id)?.[a.key] as Status) ?? "AB") === "AB")
        .map((s) => (s as any).nickname?.trim() || s.name);
      let value: string;
      if (students.length > 0 && names.length === students.length) value = "All Students are AB";
      else if (names.length === 0) value = "No Students are AB";
      else value = names.join(", ");
      lines.push("", `${a.label}:`, value);
    });

    return lines.join("\n");
  }, [date, students, byStudent]);

  const openMessagesApp = () => {
    const recipients = REPORT_NUMBERS.join(",");
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const sep = isIOS ? "&" : "?";
    window.location.href = `sms:${recipients}${sep}body=${encodeURIComponent(messageText)}`;
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, "_blank");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(messageText);
    toast.success("Report copied to clipboard");
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Daily Register</h1>
          <p className="text-muted-foreground mt-1 text-sm">Read-only view of attendance for any date.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full md:w-44" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            <Button className="w-full md:w-auto" onClick={() => setMsgOpen(true)}><MessageSquare className="h-4 w-4 mr-2" /> Message</Button>
            <Button className="w-full md:w-auto" onClick={openWhatsApp}><Send className="h-4 w-4 mr-2" /> WhatsApp</Button>
            <Button variant="outline" className="w-full md:w-auto" onClick={printFormat}><Download className="h-4 w-4 mr-2" /> Print Format</Button>
            <Button variant="outline" className="w-full md:w-auto" onClick={exportXlsx}><Download className="h-4 w-4 mr-2" /> Simple Export</Button>
          </div>
        </div>
      </div>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Daily Attendance Report — Message</DialogTitle>
            <DialogDescription>
              Absent (AB) names for every schedule on {date}. Sends to {REPORT_NUMBERS.length} numbers via your phone's
              Google Messages app.
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={messageText} className="h-72 font-mono text-xs" />
          <p className="text-xs text-muted-foreground break-all">{REPORT_NUMBERS.join(" · ")}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyMessage}><Copy className="h-4 w-4 mr-2" /> Copy text</Button>
            <Button variant="outline" onClick={openWhatsApp}><Send className="h-4 w-4 mr-2" /> WhatsApp</Button>
            <Button onClick={openMessagesApp}><MessageSquare className="h-4 w-4 mr-2" /> Open Messages</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Present (P)", value: summary.p, cls: "text-emerald-600" },
          { label: "Late (P1)", value: summary.p1, cls: "text-amber-600" },
          { label: "Very Late (P2)", value: summary.p2, cls: "text-orange-600" },
          { label: "Absent (AB)", value: summary.ab, cls: "text-red-600" },
          { label: "Not Marked", value: summary.blank, cls: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{s.label}</div><div className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Register</CardTitle>
            <CardDescription>{list.length} students</CardDescription>
          </div>
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: one card per student */}
          <div className="space-y-3 p-3 md:hidden">
            {list.map((s, idx) => {
              const r = byStudent.get(s.id);
              return (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {ACTIVITIES.map((a) => {
                      const v: Status = (r?.[a.key] as Status) ?? "AB";
                      const inner = (
                        <>
                          <div className="text-[10px] text-muted-foreground">{a.label}</div>
                          <div className={`mt-1 rounded-md px-1 py-1 text-xs font-semibold ${cellClass(v)}`}>{v}</div>
                        </>
                      );
                      return isAdmin ? (
                        <button
                          key={a.key}
                          type="button"
                          className="text-center"
                          aria-label={`Who marked ${a.label} for ${s.name}`}
                          onClick={() => {
                            const p = profiles.find((x) => x.id === r?.recorded_by);
                            setMarkInfo({
                              student: s.name,
                              activity: a.label,
                              status: v,
                              by: r?.recorded_by ? p?.full_name || p?.email || "Unknown user" : "Not marked by anyone",
                              at: r?.updated_at ?? null,
                            });
                          }}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div key={a.key} className="text-center">{inner}</div>
                      );
                    })}
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground">Slips Att.</div>
                      <div className="mt-1 rounded-md bg-sky-100 px-1 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
                        {slipCounts[s.id] ?? 0}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
            {list.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No students.</p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">No.</TableHead>
                  <TableHead>Name</TableHead>
                  {ACTIVITIES.map((a) => <TableHead key={a.key} className="text-center">{a.label}</TableHead>)}
                  <TableHead className="text-center whitespace-nowrap">Slips Attendance</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s, idx) => {
                  const r = byStudent.get(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      {ACTIVITIES.map((a) => {
                        const v: Status = (r?.[a.key] as Status) ?? "AB";
                        const badge = (
                          <span className={`inline-flex items-center justify-center min-w-9 px-2 py-1 rounded-md text-xs font-semibold ${cellClass(v)}`}>
                            {v}
                          </span>
                        );
                        return (
                          <TableCell key={a.key} className="text-center p-1">
                            {isAdmin ? (
                              <button
                                type="button"
                                aria-label={`Who marked ${a.label} for ${s.name}`}
                                onClick={() => {
                                  const p = profiles.find((x) => x.id === r?.recorded_by);
                                  setMarkInfo({
                                    student: s.name,
                                    activity: a.label,
                                    status: v,
                                    by: r?.recorded_by
                                      ? p?.full_name || p?.email || "Unknown user"
                                      : "Not marked by anyone",
                                    at: r?.updated_at ?? null,
                                  });
                                }}
                              >
                                {badge}
                              </button>
                            ) : (
                              badge
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center p-1">
                        <span className="inline-flex min-w-9 items-center justify-center rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
                          {slipCounts[s.id] ?? 0}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {list.length === 0 && (
                  <TableRow><TableCell colSpan={3 + ACTIVITIES.length} className="text-center text-muted-foreground py-8">No students.</TableCell></TableRow>
                )}

              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!markInfo} onOpenChange={(o) => !o && setMarkInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marked by</DialogTitle>
            <DialogDescription>
              {markInfo?.activity} — {markInfo?.student}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="secondary">{markInfo?.status ?? "—"}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">User: </span>
              <span className="font-medium text-foreground">{markInfo?.by}</span>
            </div>
            {markInfo?.at && (
              <div>
                <span className="text-muted-foreground">Last updated: </span>
                {new Date(markInfo.at).toLocaleString()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
