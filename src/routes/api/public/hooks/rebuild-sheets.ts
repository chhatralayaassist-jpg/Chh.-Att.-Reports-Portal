import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/rebuild-sheets")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { rebuildSheet } = await import("@/lib/google-sheets.server");
        const admin = supabaseAdmin as any;
        const { data: conn } = await admin
          .from("google_oauth_connection")
          .select("connected_by, spreadsheet_id")
          .eq("id", 1)
          .maybeSingle();
        if (!conn || !conn.spreadsheet_id) return Response.json({ ok: true, skipped: "no connection" });
        try {
          const r = await rebuildSheet(conn.connected_by);
          return Response.json({ ...r });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "err" }, { status: 500 });
        }
      },
    },
  },
});
