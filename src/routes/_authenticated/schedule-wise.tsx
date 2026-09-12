import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITIES,
  datesBetween,
  normalizeStatus,
  monthRange,
  currentMonth,
  todayISO,
  type ActivityKey,
  type AttendanceRow,
} from "@/lib/reports";
import { useAttendanceRange, useGroups, useStudents } from "@/hooks/use-report-data";

const TITLE = "Schedule Wise Attendance — Chhatralaya Attendance";
const DESC = "Date-wise register of a single schedule showing every student's P, P1, P2 or AB mark for the chosen range.";

export const Route = createFileRoute("/_authenticated/schedule-wise")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
  component: ScheduleWisePage,
});

function ScheduleWisePage() {
  const [activity, setActivity] = useState<ActivityKey>("pooja");
  const [from, setFrom] = useState(monthRange(currentMonth()).from);
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [standard, setStandard] = useState("all");
  const [group, setGroup] = useState("all");

  const end = to > from ? to : from;
  const { data: students = [] } = useStudents();
  const { data: groups = [] } = useGroups();
  const { data: attendance = [] } = useAttendanceRange(from, end);

  const days = useMemo(() => datesBetween(from, end), [from, end]);
  const act = ACTIVITIES.find((a) => a.key === activity)!;

  const latest = useMemo(() => {
    const m = new Map<string, AttendanceRow>();
    attendance.forEach((r) => m.set(`${r.student_id}|${r.attendance_date}`, r));
    return m;
  }, [attendance]);

  const groupOf = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => g.memberIds.forEach((id) => m.set(id, g.name)));
    return m;
  }, [groups]);

  const standards = useMemo(
    () => Array.from(new Set(students.map((s) => s.standard).filter(Boolean))).sort(),
    [students],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (standard !== "all" && s.standard !== standard) return false;
      if (group !== "all" && (groupOf.get(s.id) ?? "—") !== group) return false;
      if (!q) return true;
      return [s.name, s.enrollment_no, s.standard, groupOf.get(s.id) ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [students, search, standard, group, groupOf]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Schedule Wise Attendance</h1>
        <p className="text-sm text-muted-foreground">
          {act.label} · {from} to {end}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div className="grid gap-1">
            <Label className="text-xs">Schedule</Label>
            <Select value={activity} onValueChange={(v) => setActivity(v as ActivityKey)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="sw-from" className="text-xs">From</Label>
            <Input id="sw-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="sw-to" className="text-xs">To</Label>
            <Input id="sw-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-56 pl-8"
              placeholder="Search name, enrollment, standard, group"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={standard} onValueChange={setStandard}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Standards" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              {standards.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Groups" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="border bg-muted px-3 py-1 text-left text-xs">Name</th>
                  <th className="border bg-muted px-2 py-1 text-xs">Std.</th>
                  {days.map((d) => (
                    <th key={d} className={`${act.tint} border px-2 py-1 text-center text-[11px]`}>
                      {d.slice(8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="border px-3 py-1 whitespace-nowrap">{s.name}</td>
                    <td className="border px-2 py-1 text-center text-xs">{s.standard}</td>
                    {days.map((d) => {
                      const st = normalizeStatus(activity, latest.get(`${s.id}|${d}`)?.[activity] ?? null);
                      return (
                        <td
                          key={d}
                          className={`${act.tint} border px-2 py-1 text-center text-xs ${st === "AB" ? "text-destructive font-semibold" : ""}`}
                        >
                          {st}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={days.length + 2} className="p-6 text-center text-sm text-muted-foreground">
                      No students match these filters.
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
