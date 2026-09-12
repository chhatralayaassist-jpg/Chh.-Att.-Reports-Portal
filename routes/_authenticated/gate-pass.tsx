import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { dayFromDate, fmtDate } from "@/lib/slips";
import type { GatePassRow } from "@/lib/gate-pass";

export const Route = createFileRoute("/_authenticated/gate-pass")({
  head: () => ({
    meta: [
      { title: "Gate Pass — Chhatralaya Attendance" },
      { name: "description", content: "Create a gate pass request for selected students with date, reason and duration." },
      { property: "og:title", content: "Gate Pass — Chhatralaya Attendance" },
      { property: "og:description", content: "Create a gate pass request for selected students with date, reason and duration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Gate Pass — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Create a gate pass request for selected students with date, reason and duration." },
    ],
  }),
  component: GatePassPage,
});

type Student = { id: string; enrollment_no: string; name: string; group_name: string | null; standard: string | null };

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function GatePassPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [passDate, setPassDate] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [search, setSearch] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["students-gate-pass"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, enrollment_no, name, group_name, standard")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const { data: myPasses = [] } = useQuery({
    queryKey: ["my-gate-passes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gate_passes")
        .select("*")
        .eq("requested_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GatePassRow[];
    },
  });

  const nameById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.name])), [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.name, s.enrollment_no, s.group_name ?? "", s.standard ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [students, search]);

  const reset = () => {
    setPassDate(today);
    setSelected([]);
    setReason("");
    setDuration("");
    setSearch("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gate_passes").insert({
        requested_by: user!.id,
        pass_date: passDate,
        student_ids: selected,
        reason: reason.trim(),
        duration: duration.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gate pass request sent");
      reset();
      qc.invalidateQueries({ queryKey: ["my-gate-passes"] });
      qc.invalidateQueries({ queryKey: ["all-gate-passes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send request"),
  });

  const removePass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gate_passes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request deleted");
      qc.invalidateQueries({ queryKey: ["my-gate-passes"] });
      qc.invalidateQueries({ queryKey: ["all-gate-passes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const canSubmit = !!passDate && selected.length > 0 && reason.trim() && duration.trim();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gate Pass</h1>
        <p className="text-sm text-muted-foreground">Request a gate pass for one or more students.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Gate Pass</CardTitle>
          <CardDescription>Fill the details and send the request for approval.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gp-date">Date</Label>
              <Input id="gp-date" type="date" value={passDate} onChange={(e) => setPassDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Input value={passDate ? dayFromDate(passDate) : ""} readOnly />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search students"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search students"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {!filtered.length && <p className="p-2 text-sm text-muted-foreground">No students found.</p>}
              {filtered.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={selected.includes(s.id)}
                    onCheckedChange={(c) =>
                      setSelected((prev) => (c ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                    }
                  />
                  <span className="text-sm text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.enrollment_no} · {s.group_name ?? "-"} · {s.standard ?? "-"}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selected.length} selected</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gp-reason">Reason</Label>
            <Textarea id="gp-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Write your reason" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gp-time">How Much Time</Label>
            <Input id="gp-time" placeholder="e.g. 02:30 hours" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
              Send request
            </Button>
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Gate Passes</CardTitle>
          <CardDescription>{myPasses.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!myPasses.length && <p className="text-sm text-muted-foreground">No gate passes yet.</p>}
          {myPasses.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="text-sm font-medium text-foreground">{fmtDate(p.pass_date)}</span>
                <span className="text-xs text-muted-foreground">{dayFromDate(p.pass_date)}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">
                {(p.student_ids ?? []).map((id) => nameById[id] ?? id).join(", ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Reason: {p.reason}</p>
              <p className="text-sm text-muted-foreground">Time: {p.duration}</p>
              {p.status === "declined" && (
                <p className="mt-1 text-sm text-destructive">Declined: {p.decline_reason || "No message"}</p>
              )}
              {p.status === "pending" && (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="destructive"
                  disabled={removePass.isPending}
                  onClick={() => removePass.mutate(p.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
