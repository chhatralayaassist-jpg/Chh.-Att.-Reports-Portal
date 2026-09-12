import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Ban, Trash2 } from "lucide-react";
import { ACTIVITIES, dayFromDate, datesBetween, fmtDate, fmtTime, type LeaveSlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/leave-slip-requests")({
  head: () => ({
    meta: [
      { title: "Leave Slip Requests — Chhatralaya Attendance" },
      { name: "description", content: "Review, approve or decline student leave slip requests." },
      { property: "og:title", content: "Leave Slip Requests — Chhatralaya Attendance" },
      { property: "og:description", content: "Review, approve or decline student leave slip requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Leave Slip Requests — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Review, approve or decline student leave slip requests." },
    ],
  }),
  component: LeaveSlipRequestsPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function LeaveSlipRequestsPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const isReviewer = roles.includes("admin") || roles.includes("rector");
  const qc = useQueryClient();
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineMsg, setDeclineMsg] = useState("");

  const { data: slips = [] } = useQuery({
    queryKey: ["all-leave-slips", isReviewer, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("leave_slips").select("*").order("created_at", { ascending: false });
      if (!isReviewer) q = q.eq("requested_by", user!.id);
      else q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeaveSlipRow[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-leave-req"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-leave-req", isReviewer],
    enabled: isReviewer,
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

  const approve = useMutation({
    mutationFn: async (slip: LeaveSlipRow) => {
      const dates = datesBetween(slip.date_from, slip.date_to);
      const rows = dates.map((d) => {
        const row: any = {
          student_id: slip.student_id,
          attendance_date: d,
          recorded_by: user!.id,
          locked: false,
        };
        for (const a of ACTIVITIES) row[a.key] = "P";
        return row;
      });
      if (rows.length) {
        const { error } = await supabase
          .from("attendance")
          .upsert(rows, { onConflict: "student_id,attendance_date" });
        if (error) throw error;
      }
      const { error: upErr } = await supabase
        .from("leave_slips")
        .update({ status: "approved", decline_reason: null, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", slip.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Approved — attendance marked for all schedules");
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to approve"),
  });

  const decline = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const { error } = await supabase
        .from("leave_slips")
        .update({ status: "declined", decline_reason: message, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request declined");
      setDeclineFor(null);
      setDeclineMsg("");
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to decline"),
  });

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
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isReviewer ? "Leave Slip Requests" : "My Leave Slip Requests"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isReviewer ? "Approve or decline leave slips sent by staff." : "Track the status of the leave slips you sent."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>{slips.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!slips.length && <p className="text-sm text-muted-foreground">No requests.</p>}
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
                {isReviewer && (
                  <span className="text-xs text-muted-foreground">· by {requesterById[s.requested_by] ?? "—"}</span>
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
                <ReturnBlock slip={s} canEdit={roles.includes("admin")} />
              )}
              {s.status === "approved" && !s.return_date && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Waiting for the group leader to send the actual date of return.
                </p>
              )}


              {isReviewer && s.status === "pending" && (
                <div className="mt-3 space-y-2">
                  {declineFor === s.id ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Message for decline"
                        value={declineMsg}
                        onChange={(e) => setDeclineMsg(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={decline.isPending}
                          onClick={() => decline.mutate({ id: s.id, message: declineMsg.trim() })}
                        >
                          Confirm decline
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeclineFor(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(s)}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setDeclineFor(s.id); setDeclineMsg(""); }}>
                        <Ban className="mr-1 h-4 w-4" /> Decline
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isReviewer && s.status !== "pending" && (
                <div className="mt-3">
                  <Button size="sm" variant="destructive" disabled={removeSlip.isPending} onClick={() => removeSlip.mutate(s)}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    {s.status === "approved" ? "Delete Attendance" : "Delete"}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.status === "approved"
                      ? "Removes all attendance marked by this leave slip."
                      : "Declined slips have no attendance to remove."}
                  </p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnBlock({ slip, canEdit }: { slip: LeaveSlipRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(String(slip.late_days ?? 0));
  const [fine, setFine] = useState(String(slip.late_fine ?? 0));
  const [msg, setMsg] = useState(slip.late_message ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leave_slips")
        .update({
          late_days: Number(days) || 0,
          late_fine: Number(fine) || 0,
          late_message: msg.trim(),
        })
        .eq("id", slip.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Late message updated");
      qc.invalidateQueries({ queryKey: ["all-leave-slips"] });
      qc.invalidateQueries({ queryKey: ["my-leave-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
      <p className="text-sm text-foreground">
        Actual Date of Return: <b>{fmtDate(slip.return_date!)}</b> · Actual Day of Return:{" "}
        <b>{dayFromDate(slip.return_date!)}</b> · Return Time: <b>{fmtTime(slip.return_time)}</b>
      </p>

      <p className={`text-sm ${(slip.late_days ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
        {slip.late_message}
      </p>
      {canEdit && (
        <div className="space-y-2 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Days late</Label>
              <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fine (₹)</Label>
              <Input type="number" min={0} value={fine} onChange={(e) => setFine(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Message to the group leader</Label>
            <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
            Save message
          </Button>
        </div>
      )}
    </div>
  );
}
