import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { dayFromDate, fmtDate } from "@/lib/slips";
import type { GatePassRow } from "@/lib/gate-pass";

export const Route = createFileRoute("/_authenticated/gate-pass-history")({
  head: () => ({
    meta: [
      { title: "Gate Pass History — Chhatralaya Attendance" },
      { name: "description", content: "All approved and declined gate passes with full details." },
      { property: "og:title", content: "Gate Pass History — Chhatralaya Attendance" },
      { property: "og:description", content: "All approved and declined gate passes with full details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Gate Pass History — Chhatralaya Attendance" },
      { name: "twitter:description", content: "All approved and declined gate passes with full details." },
    ],
  }),
  component: GatePassHistoryPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  return <Badge variant="destructive">Declined</Badge>;
}

function GatePassHistoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: passes = [] } = useQuery({
    queryKey: ["gate-pass-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gate_passes")
        .select("*")
        .in("status", ["approved", "declined"])
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GatePassRow[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-gate-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-gate-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const nameById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.name])), [students]);
  const requesterById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? p.email ?? p.id])),
    [profiles],
  );

  const removePass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gate_passes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gate pass deleted");
      qc.invalidateQueries({ queryKey: ["gate-pass-history"] });
      qc.invalidateQueries({ queryKey: ["my-gate-passes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gate Pass History</h1>
        <p className="text-sm text-muted-foreground">Approved and declined gate passes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>{passes.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!passes.length && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
          {passes.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="text-sm font-medium text-foreground">{fmtDate(p.pass_date)}</span>
                <span className="text-xs text-muted-foreground">{dayFromDate(p.pass_date)}</span>
                <span className="text-xs text-muted-foreground">· by {requesterById[p.requested_by] ?? "—"}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">
                {(p.student_ids ?? []).map((id) => nameById[id] ?? id).join(", ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Reason: {p.reason}</p>
              <p className="text-sm text-muted-foreground">Time: {p.duration}</p>
              {p.status === "declined" && (
                <p className="mt-1 text-sm text-destructive">Declined: {p.decline_reason || "No message"}</p>
              )}
              <Button
                className="mt-3"
                size="sm"
                variant="destructive"
                disabled={removePass.isPending}
                onClick={() => removePass.mutate(p.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
