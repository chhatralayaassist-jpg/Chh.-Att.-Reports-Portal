// Client-callable server functions for Google Sheets integration.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { buildAuthorizationUrl } = await import("./google-oauth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const state = crypto.randomUUID();
    await admin.from("google_oauth_state").insert({ state, user_id: context.userId });
    const redirectUri = `${data.origin}/api/public/google/callback`;
    return { url: buildAuthorizationUrl({ redirectUri, state }) };
  });

export const getMyConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data } = await admin
      .from("google_oauth_connection")
      .select("connected_email, spreadsheet_id, created_at")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return { connected: false as const };
    const url = data.spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}/edit` : null;
    return { connected: true as const, email: data.connected_email, spreadsheetId: data.spreadsheet_id, spreadsheetUrl: url, connectedAt: data.created_at };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    await admin.from("google_oauth_connection").delete().eq("id", 1);
    return { ok: true };
  });

export const createOrLinkSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createSpreadsheetForUser, rebuildSheet } = await import("./google-sheets.server");
    const created = await createSpreadsheetForUser(context.userId);
    await rebuildSheet(context.userId);
    return created;
  });

export const rebuildMySheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { rebuildSheet } = await import("./google-sheets.server");
    return rebuildSheet(context.userId);
  });

export const mirrorAttendanceRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string; date: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertRow } = await import("./google-sheets.server");
    const admin = supabaseAdmin as any;

    const { data: att } = await admin
      .from("attendance")
      .select("*")
      .eq("student_id", data.studentId)
      .eq("attendance_date", data.date)
      .maybeSingle();
    if (!att) return { ok: false, reason: "no attendance row" };
    const { data: stu } = await admin
      .from("students")
      .select("enrollment_no, name")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!stu) return { ok: false, reason: "no student" };

    try {
      await upsertRow(context.userId, {
        student_id: data.studentId,
        enrollment_no: stu.enrollment_no,
        name: stu.name,
        date: data.date,
        pooja: att.pooja,
        ma: att.ma,
        gdc: att.gdc,
        ekant: att.ekant,
        sa: att.sa,
        ss: att.ss,
        sabha: att.sabha,
        lib: att.lib,
      });
      await admin
        .from("attendance")
        .update({ last_sheet_sync_at: new Date().toISOString() })
        .eq("id", att.id);
      return { ok: true };
    } catch (e: any) {
      console.error("mirror failed", e);
      return { ok: false, reason: e?.message ?? "mirror failed" };
    }
  });
