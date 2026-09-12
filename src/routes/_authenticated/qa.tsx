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
import { toast } from "sonner";
import { Search, Trash2, Paperclip, CheckCircle2, RotateCcw } from "lucide-react";
import { dayFromDate, fmtDate } from "@/lib/slips";

export const Route = createFileRoute("/_authenticated/qa")({
  head: () => ({
    meta: [
      { title: "Q & A — Chhatralaya Attendance" },
      { name: "description", content: "Send questions and suggestions with an optional screenshot and track whether they are done or pending." },
      { property: "og:title", content: "Q & A — Chhatralaya Attendance" },
      { property: "og:description", content: "Send questions and suggestions with an optional screenshot and track whether they are done or pending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Q & A — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Send questions and suggestions with an optional screenshot and track whether they are done or pending." },
    ],
  }),
  component: QAPage,
});

type Student = { id: string; enrollment_no: string; name: string; group_name: string | null; standard: string | null };

type SuggestionRow = {
  id: string;
  created_by: string;
  entry_date: string;
  student_id: string | null;
  suggestion: string;
  screenshot_url: string | null;
  status: string;
  remark: string | null;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  return status === "done" ? (
    <Badge className="bg-primary text-primary-foreground">Done</Badge>
  ) : (
    <Badge variant="secondary">Pending</Badge>
  );
}

function ScreenshotLink({ path }: { path: string }) {
  const open = async () => {
    const { data, error } = await supabase.storage.from("qa-screenshots").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Could not open the screenshot");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <Button size="sm" variant="outline" onClick={open}>
      <Paperclip className="h-4 w-4" /> View screenshot
    </Button>
  );
}

function QAPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const today = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState(today);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [remarkFor, setRemarkFor] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["students-qa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, enrollment_no, name, group_name, standard")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["suggestions", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SuggestionRow[];
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
    setEntryDate(today);
    setStudentId(null);
    setSearch("");
    setSuggestion("");
    setFile(null);
  };

  const send = useMutation({
    mutationFn: async () => {
      if (!suggestion.trim()) throw new Error("Please write your suggestion");
      let path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "png";
        path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("qa-screenshots").upload(path, file);
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("suggestions").insert({
        created_by: user!.id,
        entry_date: entryDate,
        student_id: studentId,
        suggestion: suggestion.trim(),
        screenshot_url: path,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suggestion sent");
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, remark }: { id: string; status: string; remark?: string }) => {
      if (status === "done" && !remark?.trim()) throw new Error("A remark is required to mark this Done");
      const patch: { status: string; remark?: string | null } = { status };
      if (status === "done") patch.remark = remark!.trim();
      const { error } = await supabase.from("suggestions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemarkFor(null);
      setRemarkText("");
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Q &amp; A</h1>
        <p className="text-sm text-muted-foreground">Send a question or suggestion. Admin marks it Done when handled.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New suggestion</CardTitle>
          <CardDescription>New suggestions stay Pending until an admin marks them Done.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Input value={dayFromDate(entryDate)} readOnly />
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
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStudentId(studentId === s.id ? null : s.id)}
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
            <Label>Suggestion</Label>
            <Textarea rows={3} placeholder="Write your suggestion" value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Upload a screenshot (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => send.mutate()} disabled={send.isPending}>Send</Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? "All suggestions" : "My suggestions"}</CardTitle>
          <CardDescription>
            {isAdmin ? "Suggestions sent by all users." : "Suggestions you sent and their status."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!rows.length && <p className="text-sm text-muted-foreground">No suggestions yet.</p>}
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-sm font-medium text-foreground">{fmtDate(r.entry_date)}</span>
                <span className="text-xs text-muted-foreground">{dayFromDate(r.entry_date)}</span>
                {r.student_id && (
                  <span className="text-sm text-foreground">· {nameById[r.student_id] ?? r.student_id}</span>
                )}
                <div className="ml-auto flex gap-1">
                  {isAdmin &&
                    (r.status === "done" ? (
                      <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: "pending" })}>
                        <RotateCcw className="h-4 w-4" /> Pending
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setRemarkFor(r.id);
                          setRemarkText("");
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Done
                      </Button>
                    ))}
                  {(isAdmin || r.created_by === user?.id) && (
                    <Button size="sm" variant="ghost" aria-label="Delete suggestion" onClick={() => del.mutate(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{r.suggestion}</p>
              {r.remark && (
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">Remark: {r.remark}</p>
              )}
              {isAdmin && remarkFor === r.id && (
                <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label>Remark (required)</Label>
                  <Textarea
                    rows={2}
                    placeholder="Write a remark before marking this Done"
                    value={remarkText}
                    onChange={(e) => setRemarkText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={setStatus.isPending || !remarkText.trim()}
                      onClick={() => setStatus.mutate({ id: r.id, status: "done", remark: remarkText })}
                    >
                      Save remark & mark Done
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRemarkFor(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {r.screenshot_url && (
                <div className="mt-2">
                  <ScreenshotLink path={r.screenshot_url} />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
