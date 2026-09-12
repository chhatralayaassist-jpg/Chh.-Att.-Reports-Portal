# Google Sheets two-way sync — full build plan

Roll out in 3 phases within one build so it ships end-to-end. Each phase is independently testable.

## Phase 1 — OAuth connect

- Public server route `POST /api/public/google/callback` — receives Google's `code`, exchanges it for tokens, stores refresh_token + access_token in existing `sheets_connections` table keyed by `user_id` (from `state` param).
- Server fn `startGoogleConnect` — generates `state`, stores in `google_oauth_state` with user_id + expiry, returns Google consent URL with scopes: `spreadsheets`, `drive.file`, plus `openid email`.
- Server fn `getMyConnection` / `disconnectGoogle`.
- Server helper `getFreshAccessToken(userId)` — auto-refreshes when `token_expires_at` is near.
- Sheets page: replace disabled button with real "Connect Google Sheets" → opens consent URL in new tab; on return shows connected email + "Disconnect".
- On first connect: auto-create a spreadsheet named "Chhatralaya Attendance" with tabs (Daily Register, Dec Day 1, Dec Day 2, Dec Day 3, Monthly Summary), store `spreadsheet_id` + URL. Show link.

## Phase 2 — App → Sheet mirror (one-way)

- Server helper `mirrorAttendanceRow(row)` — writes a single student's row into the correct tab for that date using Sheets `values:update` at a computed A1 range (row index = student order in Daily Register).
- Hook into existing attendance upsert server fn (in `attendance.tsx` mutation path — move DB write into a server fn `saveAttendance` that also fires `mirrorAttendanceRow` after DB success). Failures are logged but don't block the UI (toast: "Saved. Sheet sync pending.").
- Nightly full-rebuild server route `POST /api/public/hooks/rebuild-sheets` (pg_cron 02:00) — rewrites all tabs from DB for consistency.
- Column layout in each daily tab matches the 11-column daily register (No, Name, Pooja, M.A., G.D.C., Ekant, S.A., S.S., Sabha, Lib., Other, Total).

## Phase 3 — Sheet → App pull-back

- Server route `POST /api/public/hooks/pull-sheets` triggered by pg_cron every 60s.
- For each connected user: read each daily tab's data range, diff against DB `attendance` rows, apply changes where `updated_at` in DB is older than the poll cycle start (last-write-wins). Log conflicts to `sheets_sync_log` (new table) so admins can inspect.
- New table `sheets_sync_log`: id, user_id, at, direction, student_id, date, activity, old_value, new_value, source ('app'|'sheet').

## Technical notes

- Redirect URIs to register in Google Cloud Console (user action):
  - `https://chhatralayaattendancportal.lovable.app/api/public/google/callback`
  - `https://id-preview--c4d181ee-0c74-4ae6-9418-23d6c5faf0a1.lovable.app/api/public/google/callback`
- Tokens stored server-only; refresh token never leaves server functions.
- All Google API calls use `fetch` directly (no SDK) — Cloudflare Worker-safe.
- Two-way sync polling window means edits within the same ~60s can be overwritten; documented in the Sheets page UI.
- `sheets_connections` table already exists and fits.

## Deliverables checklist

1. Migration: `google_oauth_state`, `sheets_sync_log` tables + grants + RLS
2. Server helpers: `google-oauth.server.ts`, `google-sheets.server.ts`
3. Server fns: `startGoogleConnect`, `getMyConnection`, `disconnectGoogle`, `saveAttendance` (replaces client upsert)
4. Server routes: `/api/public/google/callback`, `/api/public/hooks/pull-sheets`, `/api/public/hooks/rebuild-sheets`
5. UI: rewritten `sheets.tsx` with real connect/disconnect + sheet link + last-sync status
6. `attendance.tsx`: switch mutation to call `saveAttendance` server fn
7. pg_cron: 60s pull, nightly rebuild

Confirm to proceed and I'll build it in one pass.
