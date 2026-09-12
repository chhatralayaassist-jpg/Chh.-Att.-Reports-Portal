import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Ban, Trash2 } from "lucide-react";
import { ACTIVITIES, dayFromDate, datesBetween, fmtDate, type SlipRow } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/slip-requests")({
  head: () => ({
    meta: [
      { title: "Attendance Slip Requests — Chhatralaya Attendance" },
      { name: "description", content: "Review, approve or decline attendance slip requests." },
      { property: "og:title", content: "Attendance Slip Requests — Chhatralaya Attendance" },
      { property: "og:description", content: "Review, approve or decline attendance slip requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Attendance Slip Requests — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Review, approve or decline attendance slip requests." },
    ],
  }),
  component: SlipRequestsPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function SlipRequestsPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const isAdmin = roles.includes("admin") || roles.includes("rector");
  const qc = useQueryClient();
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineMsg, setDeclineMsg] = useState("");

  const { data: slips = [] } = useQuery({
    queryKey: ["all-slips", isAdmin, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("attendance_slips").select("*").order("created_at", { ascending: false });
      if (!isAdmin) q = q.eq("requested_by", user!.id);
      else q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SlipRow[];
    },
  });


  const { data: students = [] } = useQuery({
    queryKey: ["students-slip-req"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-slip-req", isAdmin],
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

  const approve = useMutation({
    mutationFn: async (slip: SlipRow) => {
      const dates = datesBetween(slip.date_from, slip.date_to);
      const { data: existing, error: exErr } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", slip.student_ids)
        .in("attendance_date", dates);
      if (exErr) throw exErr;
      const key = (sid: string, d: string) => `${sid}|${d}`;
      const map = new Map((existing ?? []).map((r: any) => [key(r.student_id, r.attendance_date), r]));

      const rows: any[] = [];
      for (const sid of slip.student_ids) {
        for (const d of dates) {
          const base: any = map.get(key(sid, d)) ?? {};
          const row: any = {
            student_id: sid,
            attendance_date: d,
            dec_day: base.dec_day ?? null,
            locked: base.locked ?? false,
            recorded_by: user!.id,
          };
          for (const a of ACTIVITIES) row[a.key] = base[a.key] ?? null;
          for (const a of slip.activities) row[a] = "P";
          rows.push(row);
        }
      }
      if (rows.length) {
        const { error } = await supabase
          .from("attendance")
          .upsert(rows, { onConflict: "student_id,attendance_date" });
        if (error) throw error;
      }
      const { error: upErr } = await supabase
        .from("attendance_slips")
        .update({ status: "approved", decline_reason: null, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", slip.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Approved — attendance marked");
      qc.invalidateQueries({ queryKey: ["all-slips"] });
      qc.invalidateQueries({ queryKey: ["my-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to approve"),
  });

  const decline = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const { error } = await supabase
        .from("attendance_slips")
        .update({ status: "declined", decline_reason: message, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request declined");
      setDeclineFor(null);
      setDeclineMsg("");
      qc.invalidateQueries({ queryKey: ["all-slips"] });
      qc.invalidateQueries({ queryKey: ["my-slips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to decline"),
  });

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
      qc.invalidateQueries({ queryKey: ["all-slips"] });
      qc.invalidateQueries({ queryKey: ["my-slips"] });
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });


  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? "Attendance Slip Requests" : "My Attendance Slip Requests"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Approve or decline slips sent by staff." : "Track the status of the slips you sent."}
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
                {isAdmin && (
                  <span className="text-xs text-muted-foreground">· by {requesterById[s.requested_by] ?? "—"}</span>
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

              {isAdmin && s.status === "pending" && (
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

              {isAdmin && s.status !== "pending" && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removeSlip.isPending}
                    onClick={() => removeSlip.mutate(s)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {s.status === "approved" ? "Delete Attendance" : "Delete"}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.status === "approved"
                      ? "Removes all attendance marked by this slip."
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
