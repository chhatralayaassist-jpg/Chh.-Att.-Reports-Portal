// Server-only Google Sheets client helpers.
import { getFreshAccessToken } from "./google-oauth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
export const SHEET_TAB = "Attendance";
export const ACTIVITY_KEYS = ["pooja", "ma", "gdc", "ekant", "sa", "ss", "sabha", "lib"] as const;
export type ActivityKey = typeof ACTIVITY_KEYS[number];
export const HEADER_ROW = [
  "Date",
  "Enrollment",
  "Name",
  "Pooja",
  "M.A.",
  "G.D.C.",
  "Ekant",
  "S.A.",
  "S.S.",
  "Sabha",
  "Lib.",
  "Total",
  "StudentID",
];

async function gfetch(accessToken: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createSpreadsheetForUser(userId: string): Promise<{ id: string; url: string }> {
  const conn = await getFreshAccessToken(userId);
  if (!conn) throw new Error("Not connected");
  const body = {
    properties: { title: "Chhatralaya Attendance Register" },
    sheets: [{ properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } } }],
  };
  const created = await gfetch(conn.accessToken, SHEETS_API, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const id = created.spreadsheetId as string;
  const url = created.spreadsheetUrl as string;
  // Write header row
  await gfetch(
    conn.accessToken,
    `${SHEETS_API}/${id}/values/${encodeURIComponent(SHEET_TAB)}!A1:N1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [HEADER_ROW] }) },
  );
  const admin = supabaseAdmin as any;
  await admin
    .from("google_oauth_connection")
    .update({ spreadsheet_id: id, updated_at: new Date().toISOString() })
    .eq("id", 1);
  return { id, url };
}

export function spreadsheetUrl(id: string) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

type StudentRow = {
  student_id: string;
  enrollment_no: string;
  name: string;
  date: string;
  pooja: string | null;
  ma: string | null;
  gdc: string | null;
  ekant: string | null;
  sa: string | null;
  ss: string | null;
  sabha: string | null;
  lib: string | null;
};

function buildRow(r: StudentRow): (string | number)[] {
  const activities = [r.pooja, r.ma, r.gdc, r.ekant, r.sa, r.ss, r.sabha, r.lib];
  const total = activities.filter((v) => v === "P").length;
  return [r.date, r.enrollment_no, r.name, ...activities.map((v) => v ?? "AB"), total, r.student_id];
}


/** Read the full sheet (values array). Returns [[header], ...rows]. */
export async function readAllRows(accessToken: string, spreadsheetId: string): Promise<string[][]> {
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(SHEET_TAB)}!A1:M`;
  const data = await gfetch(accessToken, url);
  return (data.values ?? []) as string[][];
}

/** Upsert one row keyed on (date, student_id). */
export async function upsertRow(userId: string, r: StudentRow) {
  const conn = await getFreshAccessToken(userId);
  if (!conn || !conn.spreadsheetId) return;
  const rows = await readAllRows(conn.accessToken, conn.spreadsheetId);
  // rows[0] is header; find match on date (col A idx 0) + studentId (col N idx 13)
  let matchIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[0] ?? "") === r.date && (row[13] ?? "") === r.student_id) {
      matchIndex = i;
      break;
    }
  }
  const newRow = buildRow(r);
  if (matchIndex === -1) {
    // append
    const url = `${SHEETS_API}/${conn.spreadsheetId}/values/${encodeURIComponent(SHEET_TAB)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    await gfetch(conn.accessToken, url, { method: "POST", body: JSON.stringify({ values: [newRow] }) });
  } else {
    const rowNum = matchIndex + 1; // sheet rows are 1-indexed
    const url = `${SHEETS_API}/${conn.spreadsheetId}/values/${encodeURIComponent(SHEET_TAB)}!A${rowNum}:M${rowNum}?valueInputOption=RAW`;
    await gfetch(conn.accessToken, url, { method: "PUT", body: JSON.stringify({ values: [newRow] }) });
  }
}

/** Wipe and rewrite the whole tab from DB. */
export async function rebuildSheet(userId: string) {
  const admin = supabaseAdmin as any;
  const conn = await getFreshAccessToken(userId);
  if (!conn || !conn.spreadsheetId) return { ok: false, reason: "no spreadsheet" };

  const { data: students } = await admin.from("students").select("id, enrollment_no, name").order("enrollment_no");
  const { data: attendance } = await admin.from("attendance").select("*");
  const byStudent: Record<string, any> = {};
  (students ?? []).forEach((s: any) => (byStudent[s.id] = s));

  const rows: (string | number)[][] = [HEADER_ROW];
  (attendance ?? [])
    .sort((a: any, b: any) => (a.attendance_date < b.attendance_date ? -1 : 1))
    .forEach((a: any) => {
      const s = byStudent[a.student_id];
      if (!s) return;
      rows.push(
        buildRow({
          student_id: a.student_id,
          enrollment_no: s.enrollment_no,
          name: s.name,
          date: a.attendance_date,
          pooja: a.pooja,
          ma: a.ma,
          gdc: a.gdc,
          ekant: a.ekant,
          sa: a.sa,
          ss: a.ss,
          sabha: a.sabha,
          lib: a.lib,
        }),
      );
    });

  // Clear then write
  await gfetch(
    conn.accessToken,
    `${SHEETS_API}/${conn.spreadsheetId}/values/${encodeURIComponent(SHEET_TAB)}!A1:M:clear`,
    { method: "POST", body: "{}" },
  );
  await gfetch(
    conn.accessToken,
    `${SHEETS_API}/${conn.spreadsheetId}/values/${encodeURIComponent(SHEET_TAB)}!A1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: rows }) },
  );
  return { ok: true, rows: rows.length - 1 };
}
