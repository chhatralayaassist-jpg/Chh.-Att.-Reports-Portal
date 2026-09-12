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
import { ACTIVITIES, dayFromDate, datesBetween, fmtDate, fmtTime, type LeaveSlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/leave-slip-history")({
  head: () => ({
    meta: [
      { title: "Leave Slips History — Chhatralaya Attendance" },
      { name: "description", content: "Archive of approved and declined student leave slips." },
      { property: "og:title", content: "Leave Slips History — Chhatralaya Attendance" },
      { property: "og:description", content: "Archive of approved and declined student leave slips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Leave Slips History — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Archive of approved and declined student leave slips." },
    ],
  }),
  component: LeaveSlipHistoryPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  return <Badge variant="destructive">Declined</Badge>;
}

function LeaveSlipHistoryPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const { data: slips = [] } = useQuery({
    queryKey: ["leave-slips-history", user?.id],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_slips")
        .select("*")
        .neq("status", "pending")
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeaveSlipRow[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-leave-history"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-leave-history"],
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
    mutationFn: async (slip: LeaveSlipRow) => {
      if (slip.status === "approved") {
        const dates = datesBetween(slip.date_from, slip.date_to);
        const patch: Record<string, null> = {};
        for (const a of ACTIVITIES) patch[a.key] = null;
        const { error } = await supabase
          .from("attendance")
          .update(patch as any)
          .eq("student_id", slip.student_id)
          .in("attendance_date", dates);
        if (error) throw error;
      }
      const { error } = await supabase.from("leave_slips").delete().eq("id", slip.id);
      if (error) throw error;
      return slip.status;
    },
    onSuccess: (status) => {
      toast.success(status === "approved" ? "Attendance removed and slip deleted" : "Slip deleted");
      qc.invalidateQueries({ queryKey: ["leave-slips-history"] });
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Only admins can view leave slip history.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Leave Slips History</h1>
        <p className="text-sm text-muted-foreground">All leave slips that were approved or declined.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>{slips.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!slips.length && <p className="text-sm text-muted-foreground">No reviewed leave slips yet.</p>}
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
              {s.status === "approved" && s.return_date && (
                <p className="mt-1 text-sm text-foreground">
                  Actual Date of Return: <b>{fmtDate(s.return_date)}</b> · Day: <b>{dayFromDate(s.return_date)}</b> ·
                  Time: <b>{fmtTime(s.return_time)}</b>
                </p>
              )}
              {s.status === "approved" && s.late_message && (
                <p className={`mt-1 text-sm ${(s.late_days ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {s.late_message}
                </p>
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
