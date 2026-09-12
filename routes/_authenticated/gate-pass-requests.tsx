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
import { Check, Ban } from "lucide-react";
import { dayFromDate, fmtDate } from "@/lib/slips";
import type { GatePassRow } from "@/lib/gate-pass";

export const Route = createFileRoute("/_authenticated/gate-pass-requests")({
  head: () => ({
    meta: [
      { title: "Gate Pass Requests — Chhatralaya Attendance" },
      { name: "description", content: "Review, approve or decline pending gate pass requests." },
      { property: "og:title", content: "Gate Pass Requests — Chhatralaya Attendance" },
      { property: "og:description", content: "Review, approve or decline pending gate pass requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Gate Pass Requests — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Review, approve or decline pending gate pass requests." },
    ],
  }),
  component: GatePassRequestsPage,
});

function GatePassRequestsPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const isReviewer = roles.includes("admin") || roles.includes("rector");
  const qc = useQueryClient();
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineMsg, setDeclineMsg] = useState("");

  const { data: passes = [] } = useQuery({
    queryKey: ["all-gate-passes", isReviewer, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("gate_passes").select("*").order("created_at", { ascending: false });
      if (!isReviewer) q = q.eq("requested_by", user!.id);
      else q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GatePassRow[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-gate-req"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-gate-req", isReviewer],
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

  const review = useMutation({
    mutationFn: async ({ id, status, message }: { id: string; status: string; message?: string }) => {
      const { error } = await supabase
        .from("gate_passes")
        .update({
          status,
          decline_reason: status === "declined" ? (message ?? "") : null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "approved" ? "Gate pass approved" : "Gate pass declined");
      setDeclineFor(null);
      setDeclineMsg("");
      qc.invalidateQueries({ queryKey: ["all-gate-passes"] });
      qc.invalidateQueries({ queryKey: ["my-gate-passes"] });
      qc.invalidateQueries({ queryKey: ["gate-pass-history"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gate Pass Requests</h1>
        <p className="text-sm text-muted-foreground">Approve or decline pending gate pass requests.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending</CardTitle>
          <CardDescription>{passes.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!passes.length && <p className="text-sm text-muted-foreground">No pending requests.</p>}
          {passes.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Pending</Badge>
                <span className="text-sm font-medium text-foreground">{fmtDate(p.pass_date)}</span>
                <span className="text-xs text-muted-foreground">{dayFromDate(p.pass_date)}</span>
                {isReviewer && (
                  <span className="text-xs text-muted-foreground">· by {requesterById[p.requested_by] ?? "—"}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-foreground">
                {(p.student_ids ?? []).map((id) => nameById[id] ?? id).join(", ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Reason: {p.reason}</p>
              <p className="text-sm text-muted-foreground">Time: {p.duration}</p>

              {isReviewer && (
                <div className="mt-3 space-y-2">
                  {declineFor === p.id ? (
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
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: p.id, status: "declined", message: declineMsg.trim() })}
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
                      <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: p.id, status: "approved" })}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setDeclineFor(p.id); setDeclineMsg(""); }}>
                        <Ban className="mr-1 h-4 w-4" /> Decline
                      </Button>
                    </div>
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
