// Server-only Google OAuth helpers. Not importable from client bundles.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
].join(" ");

function getEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials missing");
  return { clientId, clientSecret };
}

export function buildAuthorizationUrl(params: { redirectUri: string; state: string }) {
  const { clientId } = getEnv();
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", params.state);
  u.searchParams.set("include_granted_scopes", "true");
  return u.toString();
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getEnv();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

/** Single-shared-connection semantics: the row always has id=1. userId param is kept for future-per-user use. */
export async function getFreshAccessToken(_userId: string): Promise<{ accessToken: string; spreadsheetId: string | null; email: string | null } | null> {
  const admin = supabaseAdmin as any;
  const { data, error } = await admin
    .from("google_oauth_connection")
    .select("access_token, refresh_token, token_expires_at, spreadsheet_id, connected_email")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  const expiresAt = new Date(data.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: data.access_token, spreadsheetId: data.spreadsheet_id, email: data.connected_email };
  }
  const fresh = await refreshAccessToken(data.refresh_token);
  const newExpires = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  await admin
    .from("google_oauth_connection")
    .update({ access_token: fresh.access_token, token_expires_at: newExpires, updated_at: new Date().toISOString() })
    .eq("id", 1);
  return { accessToken: fresh.access_token, spreadsheetId: data.spreadsheet_id, email: data.connected_email };
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return (await res.json()) as { email: string; name?: string; sub: string };
}
