import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, FileSpreadsheet, FileDown, Search, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITIES,
  STATUSES,
  TINT_WEIGHT,
  statesOf,
  buildRows,
  buildGroupRows,
  type ReportRow,
  type GroupSummaryRow,
} from "@/lib/reports";
import { exportExcel, exportPDF, flattenStudents, flattenGroups } from "@/lib/report-export";
import { useAttendanceRange, useGroups, useSlipsRange, useStudents } from "@/hooks/use-report-data";

export type ReportVariant = "students" | "groups";

export function ReportView({
  title,
  filename,
  from,
  to,
  controls,
  variant = "students",
}: {
  title: string;
  filename: string;
  from: string;
  to: string;
  controls?: ReactNode;
  variant?: ReportVariant;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [standard, setStandard] = useState("all");
  const [group, setGroup] = useState("all");

  const { data: students = [] } = useStudents();
  const { data: groups = [] } = useGroups();
  const { data: attendance = [], isFetching: fa } = useAttendanceRange(from, to);
  const { data: slips = [], isFetching: fs } = useSlipsRange(from, to);

  const groupOfStudent = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => g.memberIds.forEach((id) => map.set(id, g.name)));
    return map;
  }, [groups]);

  const allRows = useMemo(
    () =>
      buildRows({
        students,
        attendance,
        slips,
        from,
        to,
        groupOf: (id) => groupOfStudent.get(id) ?? "—",
      }),
    [students, attendance, slips, from, to, groupOfStudent],
  );

  const standards = useMemo(
    () => Array.from(new Set(students.map((s) => s.standard).filter(Boolean))).sort(),
    [students],
  );

  const studentRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (standard !== "all" && r.student.standard !== standard) return false;
      if (group !== "all" && r.groupName !== group) return false;
      if (!q) return true;
      return [r.student.name, r.student.enrollment_no, r.student.standard, r.groupName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [allRows, search, standard, group]);

  const groupRows = useMemo(() => {
    if (variant !== "groups") return [];
    const q = search.trim().toLowerCase();
    return buildGroupRows(allRows, groups).filter((g) => {
      if (group !== "all" && g.groupName !== group) return false;
      if (!q) return true;
      return `${g.groupName} ${g.leaderName}`.toLowerCase().includes(q);
    });
  }, [variant, allRows, groups, search, group]);

  const subtitle = from === to ? `Date: ${from}` : `Date: ${from} to ${to}`;

  const doExport = async (fmt: "excel" | "pdf") => {
    try {
      const rows =
        variant === "groups" ? flattenGroups(groupRows) : flattenStudents(studentRows);
      const payload = { title, subtitle, filename, kind: variant, rows } as const;
      if (fmt === "excel") await exportExcel(payload);
      else await exportPDF(payload);
      toast.success(`Exported ${fmt === "excel" ? "Excel" : "PDF"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["report-attendance"] });
    qc.invalidateQueries({ queryKey: ["report-slips"] });
    qc.invalidateQueries({ queryKey: ["report-students"] });
    qc.invalidateQueries({ queryKey: ["report-groups"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          {controls}
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
            <SelectTrigger className="w-40"><SelectValue placeholder="All Standards" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              {standards.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Groups" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh} aria-label="Refresh report">
            <RefreshCw className={`mr-2 h-4 w-4 ${fa || fs ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport("excel")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport("pdf")}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            {variant === "groups" ? (
              <GroupTable rows={groupRows} />
            ) : (
              <StudentTable rows={studentRows} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Shade of a schedule's colour family: P darkest, AB lightest. */
function tint(key: string, status?: string) {
  const w = status ? TINT_WEIGHT[status as keyof typeof TINT_WEIGHT] : 100;
  return { backgroundColor: `color-mix(in oklab, var(--sched-${key}) ${w}%, var(--card))` };
}

function HeadCells() {
  return (
    <>
      {ACTIVITIES.map((a) => (
        <th
          key={a.key}
          colSpan={statesOf(a.key).length}
          style={tint(a.key)}
          className="border px-2 py-1 text-center text-xs font-semibold"
        >
          {a.label}
        </th>
      ))}
      <th colSpan={4} style={tint("total")} className="border px-2 py-1 text-center text-xs font-semibold">
        Total
      </th>
    </>
  );
}

function SubHeadCells() {
  return (
    <>
      {ACTIVITIES.map((a) =>
        statesOf(a.key).map((s) => (
          <th key={`${a.key}-${s}`} style={tint(a.key, s)} className="border px-2 py-1 text-center text-[11px] font-medium">
            {s}
          </th>
        )),
      )}
      {STATUSES.map((s) => (
        <th key={`t-${s}`} style={tint("total", s)} className="border px-2 py-1 text-center text-[11px] font-medium">
          {s}
        </th>
      ))}
    </>
  );
}

function StudentTable({ rows }: { rows: ReportRow[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Sr.no</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Enrollment</th>
          <th rowSpan={2} className="border bg-muted px-3 py-1 text-left text-xs">Name</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Standard</th>
          <HeadCells />
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Atte. %</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Rank</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Slips Attendance</th>
        </tr>
        <tr><SubHeadCells /></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.student.id} className="hover:bg-muted/40">
            <td className="border px-2 py-1 text-center text-xs text-muted-foreground">{i + 1}</td>
            <td className="border px-2 py-1 text-center text-xs text-muted-foreground">{r.student.enrollment_no}</td>
            <td className="border px-3 py-1 whitespace-nowrap">{r.student.name}</td>
            <td className="border px-2 py-1 text-center text-xs">{r.student.standard}</td>
            {ACTIVITIES.map((a) =>
              statesOf(a.key).map((s) => (
                <td key={`${a.key}-${s}`} style={tint(a.key, s)} className="border px-2 py-1 text-center">
                  {r.counts[a.key][s] || ""}
                </td>
              )),
            )}
            {STATUSES.map((s) => (
              <td key={`t-${s}`} style={tint("total", s)} className="border px-2 py-1 text-center font-medium">
                {r.totals[s] || ""}
              </td>
            ))}
            <td className="border px-2 py-1 text-center font-semibold">{r.pct.toFixed(2)}%</td>
            <td className="border px-2 py-1 text-center font-medium">
              {r.rank === 1 ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Trophy className="h-3.5 w-3.5" /> 1
                </span>
              ) : (
                r.rank
              )}
            </td>
            <td className="border px-2 py-1 text-center">{r.slips}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={40} className="p-6 text-center text-sm text-muted-foreground">No students match these filters.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function GroupTable({ rows }: { rows: GroupSummaryRow[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-card">
        <tr>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Sr.no</th>
          <th rowSpan={2} className="border bg-muted px-3 py-1 text-left text-xs">Name</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Group</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Members</th>
          <HeadCells />
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Atte. %</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Rank</th>
          <th rowSpan={2} className="border bg-muted px-2 py-1 text-xs">Slips Attendance</th>
        </tr>
        <tr><SubHeadCells /></tr>
      </thead>
      <tbody>
        {rows.map((g, i) => (
          <tr key={g.groupId} className="hover:bg-muted/40">
            <td className="border px-2 py-1 text-center text-xs text-muted-foreground">{i + 1}</td>
            <td className="border px-3 py-1 whitespace-nowrap">{g.leaderName}</td>
            <td className="border px-2 py-1 text-center text-xs">{g.groupName}</td>
            <td className="border px-2 py-1 text-center">{g.memberCount}</td>
            {ACTIVITIES.map((a) =>
              statesOf(a.key).map((s) => (
                <td key={`${a.key}-${s}`} style={tint(a.key, s)} className="border px-2 py-1 text-center">
                  {g.counts[a.key][s] || ""}
                </td>
              )),
            )}
            {STATUSES.map((s) => (
              <td key={`t-${s}`} style={tint("total", s)} className="border px-2 py-1 text-center font-medium">
                {g.totals[s] || ""}
              </td>
            ))}
            <td className="border px-2 py-1 text-center font-semibold">{g.pct.toFixed(2)}%</td>
            <td className="border px-2 py-1 text-center font-medium">{g.rank}</td>
            <td className="border px-2 py-1 text-center">{g.slips}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={40} className="p-6 text-center text-sm text-muted-foreground">
              No groups yet — add them in Settings → Groups Management.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
