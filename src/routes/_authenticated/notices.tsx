import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyRoles } from "@/hooks/use-auth";
import { listAppUsers } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notices")({
  head: () => ({
    meta: [
      { title: "Notice Board — Chhatralaya Attendance" },
      { name: "description", content: "Read the latest portal notices, announcements and attached documents shared by the Chhatralaya admin team." },
      { property: "og:title", content: "Notice Board — Chhatralaya Attendance" },
      { property: "og:description", content: "Read the latest portal notices, announcements and attached documents shared by the Chhatralaya admin team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Notice Board — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Read the latest portal notices, announcements and attached documents shared by the Chhatralaya admin team." },
    ],
  }),
  component: NoticesPage,
});

type Notice = {
  id: string;
  title: string;
  description: string;
  file_url: string | null;
  file_name: string | null;
  recipient_ids: string[];
  created_at: string;
};

function FileLink({ path, name }: { path: string; name: string | null }) {
  const open = async () => {
    const { data, error } = await supabase.storage.from("notice-files").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Could not open the file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <Button size="sm" variant="outline" onClick={open}>
      <Paperclip className="h-4 w-4 mr-2" /> {name ?? "View attachment"}
    </Button>
  );
}

function NoticesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: roles = [] } = useMyRoles();
  const isAdmin = roles.includes("admin");

  const listUsers = useServerFn(listAppUsers);
  const { data: users = [] } = useQuery({
    queryKey: ["app-users-notice"],
    enabled: isAdmin,
    queryFn: async () => await listUsers(),
  });

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Notice | null>(null);

  const userName = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u: any) => m.set(u.id, u.full_name || u.email));
    return m;
  }, [users]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setFile(null);
    setRecipients([]);
  };

  const startCreate = () => {
    resetForm();
    setOpen(true);
  };

  const startEdit = (n: Notice) => {
    setEditing(n);
    setTitle(n.title);
    setDescription(n.description);
    setFile(null);
    setRecipients(n.recipient_ids ?? []);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Notice name is required");
      if (!description.trim()) throw new Error("Description is required");

      let file_url = editing?.file_url ?? null;
      let file_name = editing?.file_name ?? null;
      if (file) {
        const path = `${user!.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("notice-files").upload(path, file);
        if (upErr) throw upErr;
        file_url = path;
        file_name = file.name;
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        file_url,
        file_name,
        recipient_ids: recipients,
      };

      if (editing) {
        const { error } = await supabase.from("notices").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notices")
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Notice updated" : "Notice created");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save the notice"),
  });

  const remove = useMutation({
    mutationFn: async (n: Notice) => {
      const { error } = await supabase.from("notices").delete().eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice deleted");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not delete the notice"),
  });

  const toggleRecipient = (id: string) =>
    setRecipients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notice
          </h1>
          <p className="text-muted-foreground mt-1">All notices about the portal.</p>
        </div>
        {isAdmin && (
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" /> New notice
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading notices…</p>}
      {!isLoading && notices.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No notices yet.</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {notices.map((n) => (
          <Card key={n.id}>
            <CardHeader className="gap-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{n.title}</CardTitle>
                  <CardDescription>{new Date(n.created_at).toLocaleString()}</CardDescription>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" aria-label="Edit notice" onClick={() => startEdit(n)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      aria-label="Delete notice"
                      onClick={() => setConfirmDelete(n)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">{n.description}</p>
              {n.file_url && <FileLink path={n.file_url} name={n.file_name} />}
              {isAdmin && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {(n.recipient_ids ?? []).length === 0 ? (
                    <Badge variant="secondary">All users</Badge>
                  ) : (
                    n.recipient_ids.map((id) => (
                      <Badge key={id} variant="secondary">
                        {userName.get(id) ?? "User"}
                      </Badge>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), resetForm()))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit notice" : "Create notice"}</DialogTitle>
            <DialogDescription>Publish a notice to selected users or to everyone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notice Name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-32"
                placeholder="Write the notice…"
              />
            </div>
            <div>
              <Label>Upload a file (optional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {editing?.file_name && !file && (
                <p className="text-xs text-muted-foreground mt-1">Current file: {editing.file_name}</p>
              )}
            </div>
            <div>
              <Label>Show in which users</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select none to show this notice to all users.
              </p>
              <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                {users.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={recipients.includes(u.id)}
                      onCheckedChange={() => toggleRecipient(u.id)}
                    />
                    <span className="truncate">{u.full_name || u.email}</span>
                  </label>
                ))}
                {users.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete notice</DialogTitle>
            <DialogDescription>“{confirmDelete?.title}” will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
