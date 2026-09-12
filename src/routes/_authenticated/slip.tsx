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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, X, Pencil, Trash2 } from "lucide-react";
import { ACTIVITIES, dayFromDate, fmtDate, type SlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/slip")({
  head: () => ({
    meta: [
      { title: "Attendance Slip — Chhatralaya Attendance" },
      { name: "description", content: "Request an attendance slip for selected students, dates and schedules." },
      { property: "og:title", content: "Attendance Slip — Chhatralaya Attendance" },
      { property: "og:description", content: "Request an attendance slip for selected students, dates and schedules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Attendance Slip — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Request an attendance slip for selected students, dates and schedules." },
    ],
  }),
  component: SlipPage,
});

type Student = { id: string; enrollment_no: string; name: string; group_name: string | null; standard: string | null };

function SlipPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["students-slip"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, enrollment_no, name, group_name, standard")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const { data: mySlips = [] } = useQuery({
    queryKey: ["my-slips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_slips")
        .select("*")
        .eq("requested_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SlipRow[];
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
    setSelected([]);
    setActivities([]);
    setReason("");
    setSearch("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selected.length) throw new Error("Select at least one student");
      if (!activities.length) throw new Error("Select at least one schedule");
      if (!reason.trim()) throw new Error("Please write a reason");
      const payload = {
        requested_by: user!.id,
        date_from: dateFrom,
        date_to: dateTo < dateFrom ? dateFrom : dateTo,
        student_ids: selected,
        activities,
        reason: reason.trim(),
      };
      if (editingId) {
        const { error } = await supabase.from("attendance_slips").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_slips").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Request updated" : "Request sent");
      qc.invalidateQueries({ queryKey: ["my-slips"] });
      qc.invalidateQueries({ queryKey: ["all-slips"] });
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance_slips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request deleted");
      qc.invalidateQueries({ queryKey: ["my-slips"] });
      qc.invalidateQueries({ queryKey: ["all-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const startEdit = (s: SlipRow) => {
    setEditingId(s.id);
    setDateFrom(s.date_from);
    setDateTo(s.date_to);
    setSelected(s.student_ids ?? []);
    setActivities(s.activities ?? []);
    setReason(s.reason ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canRequest = roles.some((r) => ["admin", "group_leader"].includes(r));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Slip</h1>
        <p className="text-sm text-muted-foreground">Request attendance for students over a date range and schedules.</p>
      </div>

      {canRequest && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit request" : "New request"}</CardTitle>
            <CardDescription>All approved slips are marked present automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date from</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <p className="text-xs text-muted-foreground">Day: {dayFromDate(dateFrom)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Date to (optional)</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <p className="text-xs text-muted-foreground">Day: {dayFromDate(dateTo)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Students</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, enrollment or group"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {nameById[id] ?? id}
                      <button type="button" onClick={() => setSelected((p) => p.filter((x) => x !== id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                {filtered.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Checkbox
                        checked={on}
                        onCheckedChange={() =>
                          setSelected((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))
                        }
                      />
                      <span className="text-sm text-foreground">{s.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {s.enrollment_no} · {s.group_name ?? "-"} · {s.standard ?? "-"}
                      </span>
                    </label>
                  );
                })}
                {!filtered.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No students</div>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Schedules</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITIES.map((a) => {
                  const on = activities.includes(a.key);
                  return (
                    <Button
                      key={a.key}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      onClick={() => setActivities((p) => (on ? p.filter((x) => x !== a.key) : [...p, a.key]))}
                    >
                      {a.label}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setActivities(activities.length === ACTIVITIES.length ? [] : ACTIVITIES.map((a) => a.key))
                  }
                >
                  {activities.length === ACTIVITIES.length ? "Clear all" : "Select all"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea rows={3} placeholder="Write your reason" value={reason} onChange={(e) => setReason(e.target.value)} />
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
          <CardTitle>My Attendance Slip Requests</CardTitle>
          <CardDescription>Status of the requests you sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!mySlips.length && <p className="text-sm text-muted-foreground">No requests yet.</p>}
          {mySlips.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={s.status} />
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
              <p className="mt-2 text-sm text-foreground">
                {(s.student_ids ?? []).map((id) => nameById[id] ?? id).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Schedules: {(s.activities ?? []).map((a) => ACTIVITIES.find((x) => x.key === a)?.label ?? a).join(", ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Reason: {s.reason}</p>
              {s.status === "declined" && (
                <p className="mt-1 text-sm text-destructive">Declined: {s.decline_reason || "No message"}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}
