import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — Chhatralaya Attendance" },
      { name: "description", content: "Add, edit and import students with enrollment numbers, groups, standards and printable QR codes." },
      { property: "og:title", content: "Students — Chhatralaya Attendance" },
      { property: "og:description", content: "Add, edit and import students with enrollment numbers, groups, standards and printable QR codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Students — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Add, edit and import students with enrollment numbers, groups, standards and printable QR codes." },
    ],
  }),
  component: StudentsPage,
});

const STANDARD_OPTIONS = ["10 EM", "10 GM", "11 EM", "11 GM", "12 EM", "12 GM", "Clg."] as const;

type Student = {
  id: string;
  enrollment_no: string;
  name: string;
  nickname: string | null;
  group_name: string;
  standard: string;
  qr_token: string;
};

function StudentsPage() {
  const { data: roles = [] } = useMyRoles();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("enrollment_no");
      if (error) throw error;
      return data as Student[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nickname ?? "").toLowerCase().includes(q) ||
        s.enrollment_no.toLowerCase().includes(q) ||
        s.group_name.toLowerCase().includes(q),
    );
  }, [students, search]);

  const upsert = useMutation({
    mutationFn: async (form: Partial<Student> & { id?: string }) => {
      if (form.id) {
        const { error } = await supabase.from("students").update({
          enrollment_no: form.enrollment_no,
          name: form.name,
          nickname: form.nickname || null,
          group_name: form.group_name,
          standard: form.standard,
        }).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert({
          enrollment_no: form.enrollment_no!,
          name: form.name!,
          nickname: form.nickname || null,
          group_name: form.group_name!,
          standard: form.standard!,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importExcel = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);
      const records = rows
        .map((r) => ({
          enrollment_no: String(r["Enrollment No"] ?? r.enrollment_no ?? r["Enrollment"] ?? "").trim(),
          name: String(r["Name"] ?? r.name ?? r["Student Name"] ?? "").trim(),
          nickname: String(r["Nickname"] ?? r.nickname ?? r["Short Name"] ?? "").trim() || null,
          group_name: String(r["Group"] ?? r.group_name ?? r.group ?? "").trim(),
          standard: String(r["Standard"] ?? r.standard ?? r["Std"] ?? "").trim(),
        }))
        .filter((r) => r.enrollment_no && r.name);
      if (!records.length) throw new Error("No valid rows found. Expected columns: Enrollment No, Name, Nickname, Group, Standard");
      const { error } = await supabase.from("students").upsert(records, { onConflict: "enrollment_no" });
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success(`Imported ${n} students`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">Manage enrolled students and their QR tokens</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importExcel.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" asChild>
                <span className="cursor-pointer"><Upload className="h-4 w-4 mr-2" />Import Excel</span>
              </Button>
            </label>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Student</Button>
              </DialogTrigger>
              <StudentDialog editing={editing} onSave={(f) => upsert.mutate(f)} saving={upsert.isPending} />
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>All Students</CardTitle>
              <CardDescription>{filtered.length} of {students.length} students</CardDescription>
            </div>
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name, enrollment, group" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enrollment No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Nickname</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>QR Token</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {students.length === 0 ? "No students yet. Add one or import an Excel file." : "No matches"}
                  </TableCell></TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.enrollment_no}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.nickname ?? "—"}</TableCell>
                    <TableCell>{s.group_name}</TableCell>
                    <TableCell>{s.standard}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.qr_token}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => {
                          if (confirm(`Delete ${s.name}?`)) del.mutate(s.id);
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentDialog({ editing, onSave, saving }: { editing: Student | null; onSave: (f: any) => void; saving: boolean }) {
  const [enrollment_no, setEN] = useState(editing?.enrollment_no ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [nickname, setNick] = useState(editing?.nickname ?? "");
  const [group_name, setGroup] = useState(editing?.group_name ?? "");
  const [standard, setStd] = useState(editing?.standard ?? "");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
        <DialogDescription>QR token is generated automatically.</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => { e.preventDefault(); onSave({ id: editing?.id, enrollment_no, name, nickname, group_name, standard }); }}
        className="space-y-4"
      >
        <div><Label>Enrollment No</Label><Input value={enrollment_no} onChange={(e) => setEN(e.target.value)} required /></div>
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><Label>Nickname (short name)</Label><Input value={nickname} onChange={(e) => setNick(e.target.value)} placeholder="Used in WhatsApp / Google messages" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Group</Label><Input value={group_name} onChange={(e) => setGroup(e.target.value)} required /></div>
          <div>
            <Label>Standard</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={standard}
              onChange={(e) => setStd(e.target.value)}
              required
            >
              <option value="">Select standard</option>
              {STANDARD_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
