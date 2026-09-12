import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ACTIVITIES, dayFromDate, datesBetween, fmtDate, type SlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/slip-history")({
  head: () => ({
    meta: [
      { title: "Attendance Slips History — Chhatralaya Attendance" },
      { name: "description", content: "Archive of approved and declined attendance slip requests." },
      { property: "og:title", content: "Attendance Slips History — Chhatralaya Attendance" },
      { property: "og:description", content: "Archive of approved and declined attendance slip requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Attendance Slips History — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Archive of approved and declined attendance slip requests." },
    ],
  }),
  component: SlipHistoryPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  return <Badge variant="destructive">Declined</Badge>;
}

function SlipHistoryPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const { data: slips = [] } = useQuery({
    queryKey: ["slips-history", user?.id],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_slips")
        .select("*")
        .neq("status", "pending")
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SlipRow[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-slip-history"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-slip-history"],
    enabled: isAdmin,
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

  const removeSlip = useMutation({
    mutationFn: async (slip: SlipRow) => {
      if (slip.status === "approved") {
        const dates = datesBetween(slip.date_from, slip.date_to);
        const patch: Record<string, null> = {};
        for (const a of slip.activities) patch[a] = null;
        if (Object.keys(patch).length) {
          const { error } = await supabase
            .from("attendance")
            .update(patch as any)
            .in("student_id", slip.student_ids)
            .in("attendance_date", dates);
          if (error) throw error;
        }
      }
      const { error } = await supabase.from("attendance_slips").delete().eq("id", slip.id);
      if (error) throw error;
      return slip.status;
    },
    onSuccess: (status) => {
      toast.success(status === "approved" ? "Attendance removed and slip deleted" : "Slip deleted");
      qc.invalidateQueries({ queryKey: ["slips-history"] });
      qc.invalidateQueries({ queryKey: ["all-slips"] });
      qc.invalidateQueries({ queryKey: ["my-slips"] });
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Only admins can view slip history.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Slips History</h1>
        <p className="text-sm text-muted-foreground">All attendance slips that were approved or declined.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>{slips.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!slips.length && <p className="text-sm text-muted-foreground">No reviewed slips yet.</p>}
          {slips.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={s.status} />
                <span className="text-sm font-medium text-foreground">
                  {fmtDate(s.date_from)} → {fmtDate(s.date_to)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dayFromDate(s.date_from)} to {dayFromDate(s.date_to)}
                </span>
                <span className="text-xs text-muted-foreground">· by {requesterById[s.requested_by] ?? "—"}</span>
                {s.reviewed_at && (
                  <span className="text-xs text-muted-foreground">
                    · reviewed {new Date(s.reviewed_at).toLocaleString()}
                  </span>
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

              <div className="mt-3">
                <Button size="sm" variant="destructive" disabled={removeSlip.isPending} onClick={() => removeSlip.mutate(s)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {s.status === "approved" ? "Delete Attendance" : "Delete"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
