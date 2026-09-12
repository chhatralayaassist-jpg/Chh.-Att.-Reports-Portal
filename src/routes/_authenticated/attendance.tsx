import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanLine, Search, X, CheckCircle2, Camera, CameraOff, CalendarDays, Maximize, Minimize, Flashlight, FlashlightOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useServerFn } from "@tanstack/react-start";
import { mirrorAttendanceRow } from "@/lib/sheets.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Take Attendance — Chhatralaya Attendance" },
      { name: "description", content: "Scan student QR codes or tap to mark P, P1, P2 and AB for every daily schedule in the Chhatralaya register." },
      { property: "og:title", content: "Take Attendance — Chhatralaya Attendance" },
      { property: "og:description", content: "Scan student QR codes or tap to mark P, P1, P2 and AB for every daily schedule in the Chhatralaya register." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Take Attendance — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Scan student QR codes or tap to mark P, P1, P2 and AB for every daily schedule in the Chhatralaya register." },
    ],
  }),
  component: AttendancePage,
});

type Status = "P" | "P1" | "P2" | "AB";
const STATUSES: Status[] = ["P", "P1", "P2", "AB"];

const ACTIVITIES = [
  { key: "pooja", label: "Pooja" },
  { key: "ma", label: "M.A." },
  { key: "gdc", label: "G.D.C." },
  { key: "ekant", label: "Ekant" },
  { key: "sa", label: "S.A." },
  { key: "ss", label: "S.S." },
  { key: "sabha", label: "Sabha" },
  { key: "lib", label: "Lib." },
] as const;
type ActivityKey = typeof ACTIVITIES[number]["key"];

type Student = {
  id: string;
  enrollment_no: string;
  name: string;
  group_name: string | null;
  standard: string | null;
  qr_token: string;
};

type AttendanceRow = {
  id?: string;
  student_id: string;
  attendance_date: string;
  dec_day: "day1" | "day2" | "day3" | null;
  pooja: Status | null;
  ma: Status | null;
  gdc: Status | null;
  ekant: Status | null;
  sa: Status | null;
  ss: Status | null;
  sabha: Status | null;
  lib: Status | null;
  locked?: boolean;
};

const statusClass = (s: Status | null, active: Status) => {
  if (s !== active) return "bg-muted text-muted-foreground hover:bg-muted/70";
  switch (active) {
    case "P": return "bg-emerald-600 text-white hover:bg-emerald-600";
    case "P1": return "bg-amber-500 text-white hover:bg-amber-500";
    case "P2": return "bg-orange-500 text-white hover:bg-orange-500";
    case "AB": return "bg-red-600 text-white hover:bg-red-600";
  }
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function dayNameFromISO(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return WEEKDAYS[dt.getUTCDay()] ?? "";
}

function playBeep() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume?.();
    const master = ctx.createGain();
    master.gain.setValueAtTime(1, ctx.currentTime);
    master.connect(ctx.destination);
    // Two layered oscillators for a much louder, sharper beep
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "square" : "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.9, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    });
  } catch {
    // ignore audio errors
  }
}

function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [defaultStatus, setDefaultStatus] = useState<Status | "">("");
  const [schedule, setSchedule] = useState<ActivityKey | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string>("");
  const [lastMark, setLastMark] = useState<{ name: string; status: Status } | null>(null);

  const dayName = useMemo(() => dayNameFromISO(date), [date]);

  const sessionReady = () => {
    if (!date) { setNotice("No Date Selected — manually select a date"); return false; }
    if (!schedule) { setNotice("No Schedule Selected — manually select the schedule"); return false; }
    if (!defaultStatus) { setNotice("No Status Selected — manually select a status P, P1, P2, AB"); return false; }
    setNotice("");
    return true;
  };



  const { data: students = [] } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id,enrollment_no,name,group_name,standard,qr_token").order("enrollment_no");
      if (error) throw error;
      return data as Student[];
    },
  });

  const { data: todays = [] } = useQuery({
    queryKey: ["attendance-day", date],
    enabled: !!date,
    queryFn: async () => {

      const { data, error } = await supabase.from("attendance").select("*").eq("attendance_date", date);
      if (error) throw error;
      return data as AttendanceRow[];
    },
  });

  const byStudent = useMemo(() => {
    const m = new Map<string, AttendanceRow>();
    todays.forEach((r) => m.set(r.student_id, r));
    return m;
  }, [todays]);

  const selected = students.find((s) => s.id === selectedId) || null;
  const selectedRow = selected ? byStudent.get(selected.id) : undefined;

  const [groupFilter, setGroupFilter] = useState<string>("All");
  const [standardFilter, setStandardFilter] = useState<string>("All");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);

  const GROUPS = ["All", "SMS", "SGS", "SNS"];
  const STANDARDS = ["All", "10 EM", "10 GM", "11 EM", "11 GM", "12 EM", "12 GM", "Clg."];

  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\.$/, "");

  const matchesGroup = (s: Student, g: string) => g === "All" || norm(s.group_name) === norm(g);
  const matchesStandard = (s: Student, st: string) => st === "All" || norm(s.standard) === norm(st);

  const groupStudents = useMemo(
    () => students.filter((s) => matchesGroup(s, groupFilter) && matchesStandard(s, standardFilter)),
    [students, groupFilter, standardFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupStudents;
    return groupStudents.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.enrollment_no.toLowerCase().includes(q) ||
      (s.group_name ?? "").toLowerCase().includes(q) ||
      (s.standard ?? "").toLowerCase().includes(q)
    );
  }, [groupStudents, search]);



  const mirror = useServerFn(mirrorAttendanceRow);

  // Instant local update so scanning never waits on the network.
  const applyLocal = (ids: string[], field: ActivityKey, value: Status) => {
    qc.setQueryData(["attendance-day", date], (old: AttendanceRow[] | undefined) => {
      const list = old ? [...old] : [];
      ids.forEach((id) => {
        const i = list.findIndex((r) => r.student_id === id);
        if (i >= 0) list[i] = { ...list[i], [field]: value } as AttendanceRow;
        else
          list.push({
            student_id: id,
            attendance_date: date,
            dec_day: null,
            pooja: null, ma: null, gdc: null, ekant: null, sa: null, ss: null, sabha: null, lib: null,
            [field]: value,
          } as AttendanceRow);
      });
      return list;
    });
  };

  const upsert = useMutation({
    mutationFn: async (payload: { student_id: string; field: ActivityKey; value: Status }) => {
      const existing = byStudent.get(payload.student_id);
      const row: any = {
        student_id: payload.student_id,
        attendance_date: date,
        recorded_by: user?.id ?? null,
        pooja: existing?.pooja ?? null,
        ma: existing?.ma ?? null,
        gdc: existing?.gdc ?? null,
        ekant: existing?.ekant ?? null,
        sa: existing?.sa ?? null,
        ss: existing?.ss ?? null,
        sabha: existing?.sabha ?? null,
        lib: existing?.lib ?? null,
      };
      row[payload.field] = payload.value;
      const { error } = await supabase.from("attendance").upsert(row, { onConflict: "student_id,attendance_date" });
      if (error) throw error;
    },
    onMutate: (vars) => {
      playBeep();
      applyLocal([vars.student_id], vars.field, vars.value);
      const st = students.find((s) => s.id === vars.student_id);
      setLastMark({ name: st?.name ?? "Student", status: vars.value });
      setNotice("");
    },
    onSuccess: (_d, vars) => {
      // Fire-and-forget mirror to Google Sheets (fails silently if not connected)
      mirror({ data: { studentId: vars.student_id, date } }).catch(() => {});
    },
    onError: (e: any) => setNotice(e?.message ?? "Failed to save"),
  });

  const bulk = useMutation({
    mutationFn: async (payload: { ids: string[]; field: ActivityKey; value: Status }) => {
      const rows = payload.ids.map((id) => {
        const existing = byStudent.get(id);
        const row: any = {
          student_id: id,
          attendance_date: date,
          recorded_by: user?.id ?? null,
          pooja: existing?.pooja ?? null,
          ma: existing?.ma ?? null,
          gdc: existing?.gdc ?? null,
          ekant: existing?.ekant ?? null,
          sa: existing?.sa ?? null,
          ss: existing?.ss ?? null,
          sabha: existing?.sabha ?? null,
          lib: existing?.lib ?? null,
        };
        row[payload.field] = payload.value;
        return row;
      });
      if (rows.length === 0) throw new Error("No students in this group");
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,attendance_date" });
      if (error) throw error;
      return payload.ids;
    },
    onMutate: (vars) => {
      playBeep();
      applyLocal(vars.ids, vars.field, vars.value);
      setNotice("");
    },
    onSuccess: (ids) => {
      setLastMark({ name: `${ids.length} students`, status: defaultStatus as Status });
      ids.forEach((id) => mirror({ data: { studentId: id, date } }).catch(() => {}));
    },
    onError: (e: any) => setNotice(e?.message ?? "Failed to save"),
  });

  const handleScan = (token: string) => {
    if (!sessionReady()) return;
    const s = students.find((st) => st.qr_token === token || st.enrollment_no === token || st.id === token);
    if (!s) {
      setNotice("Unknown QR code");
      return;
    }
    setSelectedId(s.id);
    setPendingId(null);
    upsert.mutate({ student_id: s.id, field: schedule as ActivityKey, value: defaultStatus as Status });
  };


  const confirmPending = () => {
    if (!pendingId) return;
    if (!sessionReady()) return;
    setSelectedId(pendingId);
    upsert.mutate({ student_id: pendingId, field: schedule as ActivityKey, value: defaultStatus as Status });
    setPendingId(null);
  };

  const selectionLabel = (g: string, st: string) =>
    [g === "All" ? "All groups" : g, st === "All" ? null : st].filter(Boolean).join(" · ");

  const markGroup = (g: string) => {
    if (!sessionReady()) return;
    setGroupFilter(g);
    setPendingGroup(selectionLabel(g, standardFilter));
  };

  const markStandard = (st: string) => {
    if (!sessionReady()) return;
    setStandardFilter(st);
    setPendingGroup(selectionLabel(groupFilter, st));
  };

  const confirmGroup = () => {
    if (!pendingGroup) return;
    if (!sessionReady()) return;
    const ids = groupStudents.map((s) => s.id);
    bulk.mutate({ ids, field: schedule as ActivityKey, value: defaultStatus as Status });
    setPendingGroup(null);
  };




  const scheduleLabel = ACTIVITIES.find((a) => a.key === schedule)?.label ?? "";


  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Take Attendance</h1>
        <p className="text-muted-foreground mt-1">Pick date, schedule, then scan or search students.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5" /> Session</CardTitle>
          <CardDescription>Set the date, day, and schedule for this attendance session.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Day</Label>
              <Input value={dayName} readOnly placeholder="No date selected" className="bg-muted/50" />
            </div>
            <div>
              <Label className="text-xs">Schedule</Label>
              <Select value={schedule || undefined} onValueChange={(v) => setSchedule(v as ActivityKey)}>
                <SelectTrigger><SelectValue placeholder="Select a schedule" /></SelectTrigger>
                <SelectContent>
                  {ACTIVITIES.map((a) => (
                    <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={defaultStatus || undefined} onValueChange={(v) => setDefaultStatus(v as Status)}>
                <SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="P">P — Present</SelectItem>
                  <SelectItem value="P1">P1 — Late</SelectItem>
                  <SelectItem value="P2">P2 — Very Late</SelectItem>
                  <SelectItem value="AB">AB — Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(!date || !schedule || !defaultStatus) && (
            <p className="mt-3 text-sm text-destructive">
              {!date && "No Date Selected — manually select a date. "}
              {!schedule && "No Schedule Selected — manually select the schedule. "}
              {!defaultStatus && "No Status Selected — manually select a status P, P1, P2, AB."}
            </p>
          )}
          {notice && <p className="mt-3 text-sm text-destructive">{notice}</p>}


        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Find Student</CardTitle>
            <CardDescription>QR scan or manual search</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qr">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="qr"><Camera className="h-4 w-4 mr-1" /> QR Scan</TabsTrigger>
                <TabsTrigger value="search"><Search className="h-4 w-4 mr-1" /> Manual</TabsTrigger>
              </TabsList>
              <TabsContent value="qr" className="mt-4">
                <QRScannerPanel
                  onResult={handleScan}
                  status={defaultStatus}
                  onStatusChange={(s) => { setDefaultStatus(s); setNotice(""); }}
                  lastMark={lastMark}
                  scheduleLabel={scheduleLabel}
                />

              </TabsContent>
              <TabsContent value="search" className="space-y-3 mt-4">
                <div>
                  <Label className="text-xs">Groups — tap to mark everyone</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {GROUPS.map((g) => (
                      <Button
                        key={g}
                        size="sm"
                        variant={groupFilter === g ? "default" : "outline"}
                        disabled={bulk.isPending}
                        onClick={() => markGroup(g)}
                      >
                        {g}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Standard — tap to filter / mark</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {STANDARDS.map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={standardFilter === st ? "default" : "outline"}
                        disabled={bulk.isPending}
                        onClick={() => markStandard(st)}
                      >
                        {st}
                      </Button>
                    ))}
                  </div>
                </div>
                {pendingGroup && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
                    <div className="text-sm flex-1">
                      Mark <b>{groupStudents.length}</b> student(s) in{" "}
                      <b>{pendingGroup}</b> → <b>{scheduleLabel} · {defaultStatus}</b>?
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setPendingGroup(null)}>Cancel</Button>
                    <Button size="sm" disabled={bulk.isPending} onClick={confirmGroup}>OK</Button>
                  </div>
                )}

                <Input placeholder="Name, enrollment no, or group…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="border rounded-md divide-y max-h-[420px] overflow-y-auto">
                  {filtered.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground text-center">No students match.</div>
                  )}
                  {filtered.map((s) => {
                    return (
                      <button key={s.id} onClick={() => setPendingId(s.id)} className={`w-full text-left px-3 py-2 hover:bg-muted/60 ${pendingId===s.id ? "bg-primary/10" : selectedId===s.id ? "bg-muted" : ""}`}>
                        <div className="text-sm font-medium truncate">{s.name}</div>
                      </button>
                    );
                  })}
                </div>
                {pendingId && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
                    <div className="text-sm flex-1 truncate">
                      {students.find((s) => s.id === pendingId)?.name} → <b>{scheduleLabel} · {defaultStatus}</b>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={confirmPending} disabled={upsert.isPending}>OK</Button>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{selected ? selected.name : "Select a student"}</CardTitle>
                <CardDescription>
                  {selected
                    ? <>Marked <b>{scheduleLabel}</b> → <b>{(selectedRow?.[schedule as ActivityKey] ?? defaultStatus) as string}</b></>
                    : "Choose someone from the list or scan their QR code."}
                </CardDescription>
              </div>
              {selected && (
                <Button variant="ghost" size="icon" aria-label="Clear selected student" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /></Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selected && <div className="text-sm text-muted-foreground py-12 text-center">No student selected.</div>}
            {selected && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <div className="text-xl font-semibold">{selected.name}</div>
                <Badge className="text-base">{scheduleLabel} · {(selectedRow?.[schedule as ActivityKey] ?? defaultStatus) as string}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function QRScannerPanel({
  onResult,
  status,
  onStatusChange,
  lastMark,
  scheduleLabel,
}: {
  onResult: (text: string) => void;
  status: Status | "";
  onStatusChange: (s: Status) => void;
  lastMark: { name: string; status: Status } | null;
  scheduleLabel: string;
}) {
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [camError, setCamError] = useState("");
  const containerId = "qr-reader-container";
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ text: string; t: number }>({ text: "", t: 0 });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: { exact: "environment" } } as any,
        { fps: 20, qrbox: { width: 260, height: 260 } },
        (decoded) => {
          const now = Date.now();
          if (decoded === lastRef.current.text && now - lastRef.current.t < 1200) return;
          lastRef.current = { text: decoded, t: now };
          onResult(decoded);
        },
        () => {},
      )
      .catch(() =>
        // Some devices reject "exact" — retry with a soft preference.
        scanner.start(
          { facingMode: "environment" },
          { fps: 20, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            const now = Date.now();
            if (decoded === lastRef.current.text && now - lastRef.current.t < 1200) return;
            lastRef.current = { text: decoded, t: now };
            onResult(decoded);
          },
          () => {},
        ),
      )
      .catch((e: any) => {
        if (!cancelled) {
          setCamError(e?.message ?? "Camera unavailable");
          setActive(false);
        }
      });
    return () => {
      cancelled = true;
      setTorch(false);
      Promise.resolve(scanner.stop()).catch(() => {}).finally(() => {
        try { scanner.clear(); } catch {}
      });
      scannerRef.current = null;
    };
  }, [active, onResult]);

  // Track native fullscreen changes (Esc exits)
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (wrapRef.current) await wrapRef.current.requestFullscreen();
      else setFullscreen((f) => !f);
    } catch {
      setFullscreen((f) => !f);
    }
  };

  // Read the live video track directly — the most reliable torch path on Android.
  const getTrack = (): MediaStreamTrack | null => {
    const video = document.querySelector(`#${containerId} video`) as HTMLVideoElement | null;
    const stream = video?.srcObject as MediaStream | null;
    return stream?.getVideoTracks?.()[0] ?? null;
  };

  const setTorchOn = async (on: boolean) => {
    const track = getTrack();
    if (track) {
      try {
        await track.applyConstraints({ advanced: [{ torch: on } as any] } as any);
        setTorch(on);
        setCamError("");
        return true;
      } catch {
        /* fall through */
      }
    }
    const scanner: any = scannerRef.current;
    if (scanner?.applyVideoConstraints) {
      try {
        await scanner.applyVideoConstraints({ advanced: [{ torch: on }] });
        setTorch(on);
        setCamError("");
        return true;
      } catch {
        /* fall through */
      }
    }
    return false;
  };

  const toggleTorch = async () => {
    if (!active) {
      // Start the camera first, then light up as soon as the track is live.
      setActive(true);
      setCamError("");
      const deadline = Date.now() + 6000;
      const tick = async () => {
        if (await setTorchOn(true)) return;
        if (Date.now() < deadline) setTimeout(tick, 250);
        else setCamError("Torch could not be turned on for this camera.");
      };
      setTimeout(tick, 600);
      return;
    }
    const next = !torch;
    const ok = await setTorchOn(next);
    if (!ok) {
      // Retry briefly — the track may not have settled yet.
      const deadline = Date.now() + 3000;
      const tick = async () => {
        if (await setTorchOn(next)) return;
        if (Date.now() < deadline) setTimeout(tick, 250);
        else setCamError("Torch could not be turned on for this camera.");
      };
      setTimeout(tick, 300);
    }
  };

  const StatusButtons = ({ big }: { big?: boolean }) => (
    <div className="grid grid-cols-4 gap-2 w-full">
      {STATUSES.map((s) => (
        <Button
          key={s}
          type="button"
          size={big ? "lg" : "sm"}
          onClick={() => onStatusChange(s)}
          className={`${statusClass(status === s ? s : null, s)} ${big ? "text-lg font-bold" : ""}`}
        >
          {s}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setCamError(""); setActive((a) => !a); }} variant={active ? "secondary" : "default"} className="flex-1 min-w-[140px]">
          {active ? <><CameraOff className="h-4 w-4 mr-2" /> Stop Camera</> : <><Camera className="h-4 w-4 mr-2" /> Start Camera</>}
        </Button>
        <Button type="button" variant="outline" onClick={toggleFullscreen}>
          {fullscreen ? <><Minimize className="h-4 w-4 mr-2" /> Exit (Esc)</> : <><Maximize className="h-4 w-4 mr-2" /> Fullscreen</>}
        </Button>
        <Button type="button" variant={torch ? "default" : "outline"} onClick={toggleTorch}>
          {torch ? <><FlashlightOff className="h-4 w-4 mr-2" /> Torch Off</> : <><Flashlight className="h-4 w-4 mr-2" /> Torch On</>}
        </Button>
      </div>
      <StatusButtons />
      {camError && <p className="text-sm text-destructive">{camError}</p>}
      <div
        ref={wrapRef}
        className={fullscreen
          ? "fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 p-4"
          : ""}
      >
        <div
          id={containerId}
          className={fullscreen
            ? "w-full max-w-2xl aspect-square bg-black rounded-md overflow-hidden"
            : "w-full aspect-square bg-muted/40 rounded-md overflow-hidden"}
        />
        {fullscreen && (
          <div className="w-full max-w-2xl space-y-3">
            <div className="text-center text-sm text-muted-foreground">
              {scheduleLabel ? `${scheduleLabel} · ` : ""}Tap a status, then scan
            </div>
            <StatusButtons big />
            <div className="min-h-6 text-center text-base font-semibold">
              {lastMark ? `${lastMark.name} → ${lastMark.status}` : ""}
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={toggleTorch}>
                {torch ? <><FlashlightOff className="h-4 w-4 mr-2" /> Torch Off</> : <><Flashlight className="h-4 w-4 mr-2" /> Torch On</>}
              </Button>
              <Button variant="outline" onClick={toggleFullscreen}><Minimize className="h-4 w-4 mr-2" /> Exit Fullscreen (Esc)</Button>
            </div>
          </div>
        )}
      </div>
      {!fullscreen && lastMark && (
        <div className="text-sm font-medium text-emerald-600">{lastMark.name} → {lastMark.status}</div>
      )}
      <div className="space-y-2">
        <Label className="text-xs">Or type QR token / enrollment no</Label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            onResult(manual.trim());
            setManual("");
          }}
          className="flex gap-2"
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Scan with USB reader or paste…" />
          <Button type="submit">Go</Button>
        </form>
      </div>
    </div>
  );
}

