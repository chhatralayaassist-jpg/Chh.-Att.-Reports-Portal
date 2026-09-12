import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, AlertCircle, ExternalLink, Loader2, Unplug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  startGoogleConnect,
  getMyConnection,
  disconnectGoogle,
  createOrLinkSpreadsheet,
  rebuildMySheet,
} from "@/lib/sheets.functions";

export const Route = createFileRoute("/_authenticated/sheets")({
  head: () => ({
    meta: [
      { title: "Google Sheets — Chhatralaya Attendance" },
      { name: "description", content: "Connect a Google spreadsheet and keep Chhatralaya attendance records synced both ways automatically." },
      { property: "og:title", content: "Google Sheets — Chhatralaya Attendance" },
      { property: "og:description", content: "Connect a Google spreadsheet and keep Chhatralaya attendance records synced both ways automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Google Sheets — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Connect a Google spreadsheet and keep Chhatralaya attendance records synced both ways automatically." },
    ],
  }),
  component: SheetsPage,
});

function SheetsPage() {
  const qc = useQueryClient();
  const getConn = useServerFn(getMyConnection);
  const startConn = useServerFn(startGoogleConnect);
  const disconn = useServerFn(disconnectGoogle);
  const createSheet = useServerFn(createOrLinkSpreadsheet);
  const rebuild = useServerFn(rebuildMySheet);

  const { data: conn, isLoading } = useQuery({
    queryKey: ["google-conn"],
    queryFn: () => getConn(),
  });

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "google-oauth") {
        qc.invalidateQueries({ queryKey: ["google-conn"] });
        if (e.data.ok) toast.success("Google connected");
        else toast.error("Google connection failed");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [qc]);

  const connectMut = useMutation({
    mutationFn: async () => startConn({ data: { origin: window.location.origin } }),
    onSuccess: (r) => {
      window.open(r.url, "google-oauth", "width=560,height=680");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to start OAuth"),
  });

  const disconnMut = useMutation({
    mutationFn: () => disconn(),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["google-conn"] });
    },
  });

  const createMut = useMutation({
    mutationFn: () => createSheet(),
    onSuccess: (r) => {
      toast.success("Spreadsheet created");
      qc.invalidateQueries({ queryKey: ["google-conn"] });
      window.open(r.url, "_blank");
    },
    onError: (e: any) => toast.error(e?.message ?? "Create failed"),
  });

  const rebuildMut = useMutation({
    mutationFn: () => rebuild(),
    onSuccess: (r: any) => toast.success(`Rebuilt · ${r?.rows ?? 0} rows`),
    onError: (e: any) => toast.error(e?.message ?? "Rebuild failed"),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Google Sheets sync</h1>
        <p className="text-muted-foreground mt-1">
          One-way live sync. Every attendance change is written to your spreadsheet instantly.
          The sheet is a read-only mirror — edits made there are not sent back to the app.
        </p>
      </div>


      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
              <Sheet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Google account</CardTitle>
              <CardDescription>Connect once, then all attendance data mirrors automatically.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading connection…
            </div>
          )}

          {!isLoading && conn && !conn.connected && (
            <Button onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
              {connectMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Connect Google Sheets
            </Button>
          )}

          {!isLoading && conn?.connected && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm">
                Connected as <b>{conn.email}</b>
              </div>
              {conn.spreadsheetUrl ? (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a href={conn.spreadsheetUrl} target="_blank" rel="noreferrer">
                      Open spreadsheet <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => rebuildMut.mutate()} disabled={rebuildMut.isPending}>
                    {rebuildMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Full rebuild
                  </Button>
                  <Button variant="ghost" onClick={() => disconnMut.mutate()} disabled={disconnMut.isPending}>
                    <Unplug className="h-4 w-4 mr-2" /> Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No spreadsheet yet — create one to start mirroring.</p>
                  <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                    {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Create spreadsheet
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
            <div className="flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">One-time Google Cloud setup</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>In <a className="underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud → Credentials</a>, edit the OAuth Web Client.</li>
                  <li>Add these <b>Authorized redirect URIs</b>:</li>
                </ol>
                <pre className="bg-background/60 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
{`https://chhatralayaattendancportal.lovable.app/api/public/google/callback
https://id-preview--c4d181ee-0c74-4ae6-9418-23d6c5faf0a1.lovable.app/api/public/google/callback`}
                </pre>
                <p className="text-muted-foreground">Enable <b>Google Sheets API</b> and <b>Google Drive API</b>. Then click Connect above.</p>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Note: sync is one-way (app → sheet). Manual edits in the spreadsheet will be overwritten on the next save or full rebuild.
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
