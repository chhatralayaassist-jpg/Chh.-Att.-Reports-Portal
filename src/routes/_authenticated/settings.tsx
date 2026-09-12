import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  Loader2,
  UserPlus,
  Trash2,
  Save,
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import { GroupsManagement } from "@/components/groups-management";
import { useMyRoles } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listAppUsers,
  createAppUser,
  updateAppUser,
  deleteAppUser,
  exportAllData,
  importAllData,
  deleteAllData,
  type AppRoleName,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Chhatralaya Attendance Portal" },
      { name: "description", content: "Theme, login credentials and data management for the Chhatralaya attendance portal." },
      { property: "og:title", content: "Settings — Chhatralaya Attendance Portal" },
      { property: "og:description", content: "Theme, login credentials and data management for the Chhatralaya attendance portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Settings — Chhatralaya Attendance Portal" },
      { name: "twitter:description", content: "Theme, login credentials and data management for the Chhatralaya attendance portal." },
    ],
  }),
  component: SettingsPage,
});

const ROLES: { value: AppRoleName; label: string; tabs: string }[] = [
  { value: "admin", label: "Admin", tabs: "All tabs (Attendance, Students, Daily, Reports, Sheets, Settings)" },
  { value: "attendance_taker", label: "Attendance Taker", tabs: "Take Attendance" },
  { value: "rector", label: "Rector", tabs: "Daily Register, Dec Day, Monthly" },
  { value: "group_leader", label: "Group Leader", tabs: "Daily Attendance Report" },
];

function SettingsPage() {
  const { data: myRoles = [] } = useMyRoles();
  const isAdmin = myRoles.includes("admin");
  const { theme, setTheme } = useTheme();

  if (!isAdmin) {
    return (
      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Only administrators can open this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Appearance, login credentials and data management.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose light or dark mode for the whole portal.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
          >
            <Sun className="mr-2 h-4 w-4" /> Light mode
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
          >
            <Moon className="mr-2 h-4 w-4" /> Dark mode
          </Button>
        </CardContent>
      </Card>

      <GroupsManagement />
      <CredentialsSection />
      <LeaveSlipSettings />
      <DangerZone />
    </div>
  );
}

function LeaveSlipSettings() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [rate, setRate] = useState<string>("");

  const { data: permitters = [] } = useQuery({
    queryKey: ["permitters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permitters").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: savedRate = "100" } = useQuery({
    queryKey: ["late-fine-rate-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "late_fine_per_day")
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? "100";
    },
  });

  const addM = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Write a name first");
      const { error } = await supabase.from("permitters").insert({ name: newName.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      toast.success("Option added");
      qc.invalidateQueries({ queryKey: ["permitters"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add option"),
  });

  const renameM = useMutation({
    mutationFn: async (v: { id: string; name: string }) => {
      const { error } = await supabase.from("permitters").update({ name: v.name.trim() }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Option updated");
      qc.invalidateQueries({ queryKey: ["permitters"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update option"),
  });

  const removeM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("permitters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Option removed");
      qc.invalidateQueries({ queryKey: ["permitters"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not remove option"),
  });

  const rateM = useMutation({
    mutationFn: async () => {
      const value = String(Number(rate || savedRate) || 0);
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "late_fine_per_day", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Late fine updated");
      qc.invalidateQueries({ queryKey: ["late-fine-rate-setting"] });
      qc.invalidateQueries({ queryKey: ["late-fine-rate"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave slip options</CardTitle>
        <CardDescription>
          Manage the "Permitted by" choices and the late-return fine used on leave slips.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Permitted by options</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="max-w-xs"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Rector"
            />
            <Button size="sm" onClick={() => addM.mutate()} disabled={addM.isPending}>
              <UserPlus className="mr-2 h-4 w-4" /> Add option
            </Button>
          </div>
          <div className="space-y-2">
            {permitters.map((p) => (
              <PermitterRow
                key={p.id}
                permitter={p}
                onRename={(name) => renameM.mutate({ id: p.id, name })}
                onDelete={() => removeM.mutate(p.id)}
              />
            ))}
            {!permitters.length && <p className="text-sm text-muted-foreground">No options yet.</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Late return fine per day (₹)</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="w-32"
              type="number"
              min={0}
              value={rate === "" ? savedRate : rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => rateM.mutate()} disabled={rateM.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Counted in whole days: every complete day after the decided return date adds this amount.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PermitterRow({
  permitter,
  onRename,
  onDelete,
}: {
  permitter: { id: string; name: string };
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(permitter.name);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
      <Button size="sm" variant="outline" onClick={() => onRename(name)} disabled={!name.trim()}>
        <Save className="mr-2 h-4 w-4" /> Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CredentialsSection() {
  const qc = useQueryClient();
  const list = useServerFn(listAppUsers);
  const create = useServerFn(createAppUser);
  const update = useServerFn(updateAppUser);
  const remove = useServerFn(deleteAppUser);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => list({ data: undefined as never }),
  });

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<AppRoleName[]>([]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["app-users"] });

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: { full_name: newName, email: newEmail, password: newPassword, roles: newRoles },
      }),
    onSuccess: () => {
      toast.success("User created");
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRoles([]);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create user"),
  });

  const updateM = useMutation({
    mutationFn: (v: {
      id: string;
      full_name?: string;
      email?: string;
      password?: string;
      roles?: AppRoleName[];
    }) => update({ data: v }),
    onSuccess: () => {
      toast.success("User updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update user"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("User deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not delete user"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login credentials</CardTitle>
        <CardDescription>
          Add users, change usernames and passwords, and control which tabs each user can open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add new user
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Manan Babariya" />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@gmail.com"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="min 6 characters"
              />
            </div>
          </div>
          <RolePicker value={newRoles} onChange={setNewRoles} />
          <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
            {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create user
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onSave={(v) => updateM.mutate({ id: u.id, ...v })}
                onDelete={() => deleteM.mutate(u.id)}
                saving={updateM.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RolePicker({
  value,
  onChange,
}: {
  value: AppRoleName[];
  onChange: (v: AppRoleName[]) => void;
}) {
  const toggle = (r: AppRoleName) =>
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  return (
    <div className="space-y-2">
      <Label>Tab access</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {ROLES.map((r) => (
          <label key={r.value} className="flex items-start gap-2 rounded-md border p-2 text-sm">
            <Checkbox checked={value.includes(r.value)} onCheckedChange={() => toggle(r.value)} />
            <span>
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.tabs}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function UserRow({
  user,
  onSave,
  onDelete,
  saving,
}: {
  user: { id: string; username: string; email: string; full_name?: string; roles: AppRoleName[] };
  onSave: (v: {
    full_name?: string;
    email?: string;
    password?: string;
    roles?: AppRoleName[];
  }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AppRoleName[]>(user.roles);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{user.full_name || user.email}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
        {user.roles.map((r) => (
          <Badge key={r} variant="secondary" className="text-[10px]">
            {ROLES.find((x) => x.value === r)?.label ?? r}
          </Badge>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>New password</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="leave blank to keep"
          />
        </div>
      </div>
      <RolePicker value={roles} onChange={setRoles} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={saving}
          onClick={() =>
            onSave({
              full_name: fullName !== (user.full_name ?? "") ? fullName : undefined,
              email: email !== user.email ? email : undefined,
              password: password || undefined,
              roles,
            })
          }
        >
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

function DangerZone() {
  const exportFn = useServerFn(exportAllData);
  const importFn = useServerFn(importAllData);
  const deleteFn = useServerFn(deleteAllData);

  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const guard = () => {
    if (!password) {
      toast.error("Enter the danger zone password first");
      return false;
    }
    return true;
  };

  const doExport = async () => {
    if (!guard()) return;
    setBusy("export");
    try {
      const data = await exportFn({ data: { password } });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chhatralaya-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    if (!guard()) return;
    if (!file) {
      toast.error("Choose an exported JSON file");
      return;
    }
    setBusy("import");
    try {
      const payload = JSON.parse(await file.text());
      const res = await importFn({ data: { password, payload } });
      const detail = Object.entries(res.imported)
        .map(([t, n]) => `${t}: ${n}`)
        .join(", ");
      toast.success(`Imported ${res.total} rows${detail ? ` (${detail})` : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (!guard()) return;
    if (!confirm("Delete ALL app data (students, attendance, slips, suggestions, settings)? This cannot be undone.")) return;
    setBusy("delete");
    try {
      await deleteFn({ data: { password } });
      toast.success("All app data deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" /> Danger zone
        </CardTitle>
        <CardDescription>
          Full A–Z backup: export every table to one JSON file, restore it back, or wipe all app data. Needs the danger zone password; import and delete cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <Label>Danger zone password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doExport} disabled={busy === "export"}>
            {busy === "export" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export all app data
          </Button>
          <Button variant="destructive" onClick={doDelete} disabled={busy === "delete"}>
            {busy === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete all data
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Import all app data</Label>
            <Input
              type="file"
              accept="application/json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button variant="outline" onClick={doImport} disabled={busy === "import"}>
            {busy === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
