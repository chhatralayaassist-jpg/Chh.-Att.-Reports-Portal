import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Pencil, Trash2 } from "lucide-react";
import { ACTIVITIES, datesBetween, dayFromDate, fmtDate, fmtTime, computeLate, lateMessage, type LeaveSlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/leave-slip")({
  head: () => ({
    meta: [
      { title: "Leave Slip — Chhatralaya Attendance" },
      { name: "description", content: "Request leave for a student over a decided date range with a reason and permission." },
      { property: "og:title", content: "Leave Slip — Chhatralaya Attendance" },
      { property: "og:description", content: "Request leave for a student over a decided date range with a reason and permission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Leave Slip — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Request leave for a student over a decided date range with a reason and permission." },
    ],
  }),
  component: LeaveSlipPage,
});

type Student = { id: string; enrollment_no: string; name: string; group_name: string | null; standard: string | null };

export function LeaveStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function LeaveSlipPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [leaveTime, setLeaveTime] = useState("");
  const [decidedReturnTime, setDecidedReturnTime] = useState("");
  const [permittedBy, setPermittedBy] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [returnDrafts, setReturnDrafts] = useState<Record<string, string>>({});
  const [returnTimeDrafts, setReturnTimeDrafts] = useState<Record<string, string>>({});


  const { data: students = [] } = useQuery({
    queryKey: ["students-leave-slip"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, enrollment_no, name, group_name, standard")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const { data: permitters = [] } = useQuery({
    queryKey: ["permitters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permitters").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: fineRate = 100 } = useQuery({
    queryKey: ["late-fine-rate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "late_fine_per_day")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.value ?? 100) || 100;
    },
  });

  const { data: mySlips = [] } = useQuery({
    queryKey: ["my-leave-slips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_slips")
        .select("*")
        .eq("requested_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeaveSlipRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.name, s.enrollment_no, s.group_name ?? "", s.standard ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [students, search]);

  const nameById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.name])), [students]);

  const reset = () => {
    setEditingId(null);
    setDateFrom(today);
    setDateTo(today);
    setStudentId(null);
    setReason("");
    setLeaveTime("");
    setDecidedReturnTime("");

    setPermittedBy([]);
    setSearch("");
  };

  const togglePermitter = (name: string) =>
    setPermittedBy((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const save = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("Select a student");
      if (!reason.trim()) throw new Error("Please write a reason");
      if (!permittedBy.length) throw new Error("Select at least one 'Permitted by' option");
      const payload = {
        requested_by: user!.id,
        student_id: studentId,
        date_from: dateFrom,
        date_to: dateTo < dateFrom ? dateFrom : dateTo,
        reason: reason.trim(),
        permitted_by: permittedBy,
        leave_time: leaveTime || null,
        decided_return_time: decidedReturnTime || null,

      };
      if (editingId) {
        const { error } = await supabase.from("leave_slips").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leave_slips").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Request updated" : "Request sent");
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leave_slips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request deleted");
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const sendReturn = useMutation({
    mutationFn: async (slip: LeaveSlipRow) => {
      const rd = returnDrafts[slip.id];
      if (!rd) throw new Error("Choose the actual date of return");
      const { days, fine } = computeLate(slip.date_to, rd, fineRate);
      const { error } = await supabase
        .from("leave_slips")
        .update({
          return_date: rd,
          return_time: returnTimeDrafts[slip.id] || null,

          return_submitted_at: new Date().toISOString(),
          late_days: days,
          late_fine: fine,
          late_message: lateMessage(days, fine),
        })
        .eq("id", slip.id);
      if (error) throw error;

      // Late return: the extra days are still counted as present in every schedule.
      const extraDates = datesBetween(slip.date_from, rd).filter((d) => d > slip.date_to);
      if (extraDates.length) {
        const rows = extraDates.map((d) => {
          const row: any = {
            student_id: slip.student_id,
            attendance_date: d,
            recorded_by: user!.id,
            locked: false,
          };
          for (const a of ACTIVITIES) row[a.key] = "P";
          return row;
        });
        const { error: attErr } = await supabase
          .from("attendance")
          .upsert(rows, { onConflict: "student_id,attendance_date" });
        if (attErr) throw attErr;
      }
      return lateMessage(days, fine);
    },
    onSuccess: (msg) => {
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });


  const startEdit = (s: LeaveSlipRow) => {
    setEditingId(s.id);
    setDateFrom(s.date_from);
    setDateTo(s.date_to);
    setStudentId(s.student_id);
    setReason(s.reason ?? "");
    setPermittedBy(s.permitted_by ?? []);
    setLeaveTime(s.leave_time ?? "");
    setDecidedReturnTime(s.decided_return_time ?? "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canRequest = roles.some((r) => ["admin", "group_leader"].includes(r));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leave Slip</h1>
        <p className="text-sm text-muted-foreground">Request leave for one student over a decided date range.</p>
      </div>

      {canRequest && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit request" : "New request"}</CardTitle>
            <CardDescription>Approved leave marks the student present in all schedules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Today's Date</Label>
                <Input value={fmtDate(today)} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Today's Day</Label>
                <Input value={dayFromDate(today)} readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, enrollment or group"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {studentId && (
                <p className="text-sm text-foreground">
                  Selected: <b>{nameById[studentId]}</b>
                </p>
              )}
              <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStudentId(s.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 ${studentId === s.id ? "bg-primary/10" : ""}`}
                  >
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {s.enrollment_no} · {s.group_name ?? "-"} · {s.standard ?? "-"}
                    </span>
                  </button>
                ))}
                {!filtered.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No students</div>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea rows={3} placeholder="Write a reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Decided Date from</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Decided Date to</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Decided Day: {dayFromDate(dateFrom)} to {dayFromDate(dateTo)}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Decided Leave Time</Label>
                <Input type="time" value={leaveTime} onChange={(e) => setLeaveTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Decided Return Time</Label>
                <Input type="time" value={decidedReturnTime} onChange={(e) => setDecidedReturnTime(e.target.value)} />
              </div>
            </div>


            <div className="space-y-2">
              <Label>Permitted by</Label>
              {!permitters.length && (
                <p className="text-xs text-muted-foreground">No options yet — an admin can add them in Settings.</p>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                {permitters.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={permittedBy.includes(p.name)} onCheckedChange={() => togglePermitter(p.name)} />
                    <span className="text-foreground">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {editingId ? "Update request" : "Send a request"}
              </Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Leave Slip Requests</CardTitle>
          <CardDescription>Status of the leave requests you sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!mySlips.length && <p className="text-sm text-muted-foreground">No requests yet.</p>}
          {mySlips.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <LeaveStatusBadge status={s.status} />
                <span className="text-sm font-medium text-foreground">
                  {fmtDate(s.date_from)} → {fmtDate(s.date_to)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dayFromDate(s.date_from)} to {dayFromDate(s.date_to)}
                </span>
                {s.status === "pending" && (
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-foreground">{nameById[s.student_id] ?? s.student_id}</p>
              <p className="mt-1 text-sm text-muted-foreground">Reason: {s.reason}</p>
              {(s.leave_time || s.decided_return_time) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Decided Leave Time: {fmtTime(s.leave_time)} · Decided Return Time: {fmtTime(s.decided_return_time)}
                </p>
              )}

              {!!s.permitted_by?.length && (
                <p className="mt-1 text-sm text-muted-foreground">Permitted by: {s.permitted_by.join(", ")}</p>
              )}
              {s.status === "declined" && (
                <p className="mt-1 text-sm text-destructive">Declined: {s.decline_reason || "No message"}</p>
              )}

              {s.status === "approved" && (
                <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Return details</p>
                  {s.return_date ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Actual Date of Return: {fmtDate(s.return_date)} · Actual Day of Return: {dayFromDate(s.return_date)} · Return Time: {fmtTime(s.return_time)}
                      </p>

                      <p className={`text-sm ${(s.late_days ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}>
                        {s.late_message}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Actual Date of Return</Label>
                          <Input
                            type="date"
                            value={returnDrafts[s.id] ?? ""}
                            onChange={(e) => setReturnDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Actual Day of Return</Label>
                          <Input value={returnDrafts[s.id] ? dayFromDate(returnDrafts[s.id]!) : ""} readOnly />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Return Time</Label>
                          <Input
                            type="time"
                            value={returnTimeDrafts[s.id] ?? ""}
                            onChange={(e) => setReturnTimeDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" disabled={sendReturn.isPending} onClick={() => sendReturn.mutate(s)}>
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReturnDrafts((d) => ({ ...d, [s.id]: "" }))}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
