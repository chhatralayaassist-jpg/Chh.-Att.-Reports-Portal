import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGroups } from "@/hooks/use-report-data";

type Student = { id: string; name: string; enrollment_no: string; standard: string };

export function GroupsManagement() {
  const qc = useQueryClient();
  const { data: groups = [] } = useGroups();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberPick, setMemberPick] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["groups-students"],
    queryFn: async (): Promise<Student[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, enrollment_no, standard")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const nameById = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students]);

  /** Students already used by another group (leader or member). */
  const taken = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.id === editingId) return;
      g.memberIds.forEach((id) => set.add(id));
      set.add(g.leaderId);
    });
    return set;
  }, [groups, editingId]);

  const available = students.filter((s) => !taken.has(s.id));

  const reset = () => {
    setEditingId(null);
    setName("");
    setLeaderId("");
    setMemberIds([]);
    setMemberPick("");
    setOpen(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!leaderId) throw new Error("Select a group leader");
      if (editingId) {
        const { error } = await supabase
          .from("report_groups")
          .update({ name: name.trim() || null, leader_student_id: leaderId })
          .eq("id", editingId);
        if (error) throw error;
        const { error: de } = await supabase.from("report_group_members").delete().eq("group_id", editingId);
        if (de) throw de;
        if (memberIds.length) {
          const { error: ie } = await supabase
            .from("report_group_members")
            .insert(memberIds.map((student_id) => ({ group_id: editingId, student_id })));
          if (ie) throw ie;
        }
        return;
      }
      const { data, error } = await supabase
        .from("report_groups")
        .insert({ name: name.trim() || null, leader_student_id: leaderId })
        .select("id")
        .single();
      if (error) throw error;
      if (memberIds.length) {
        const { error: ie } = await supabase
          .from("report_group_members")
          .insert(memberIds.map((student_id) => ({ group_id: data.id, student_id })));
        if (ie) throw ie;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Group updated" : "Group added");
      qc.invalidateQueries({ queryKey: ["report-groups"] });
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save group"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Group deleted");
      qc.invalidateQueries({ queryKey: ["report-groups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete group"),
  });

  const startEdit = (gid: string) => {
    const g = groups.find((x) => x.id === gid);
    if (!g) return;
    setEditingId(gid);
    setName(g.name === nameById.get(g.leaderId) ? "" : g.name);
    setLeaderId(g.leaderId);
    setMemberIds(g.memberIds.filter((id) => id !== g.leaderId));
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Groups Management</CardTitle>
          <CardDescription>Create report groups with a leader and members. A student can belong to only one group.</CardDescription>
        </div>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add New Group
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="grp-name" className="text-xs">Group name (optional)</Label>
                <Input
                  id="grp-name"
                  placeholder="Defaults to leader name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Group Leader</Label>
                <Select value={leaderId} onValueChange={setLeaderId}>
                  <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
                  <SelectContent>
                    {available
                      .filter((s) => !memberIds.includes(s.id))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} · {s.standard}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Group Members</Label>
              <Select
                value={memberPick}
                onValueChange={(v) => {
                  setMemberIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setMemberPick("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Add member" /></SelectTrigger>
                <SelectContent>
                  {available
                    .filter((s) => s.id !== leaderId && !memberIds.includes(s.id))
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} · {s.standard}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex flex-wrap gap-1">
                {memberIds.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {nameById.get(id) ?? id}
                    <button
                      type="button"
                      aria-label={`Remove ${nameById.get(id) ?? "member"}`}
                      onClick={() => setMemberIds((prev) => prev.filter((m) => m !== id))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {!memberIds.length && <span className="text-xs text-muted-foreground">No members yet.</span>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {editingId ? "Save changes" : "Create group"}
              </Button>
              <Button size="sm" variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  Leader: {g.leaderName} · {g.memberIds.length} member(s)
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(g.id)} aria-label={`Edit ${g.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => remove.mutate(g.id)}
                  aria-label={`Delete ${g.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!groups.length && <p className="text-sm text-muted-foreground">No groups yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
