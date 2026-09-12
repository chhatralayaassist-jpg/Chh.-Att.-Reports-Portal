import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        if (err) return htmlResponse(`Google returned an error: ${err}`, false);
        if (!code || !state) return htmlResponse("Missing code or state", false);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { exchangeCodeForTokens, fetchGoogleUserInfo } = await import("@/lib/google-oauth.server");
        const admin = supabaseAdmin as any;

        // Validate state and consume
        const { data: stateRow } = await admin
          .from("google_oauth_state")
          .select("user_id, created_at")
          .eq("state", state)
          .maybeSingle();
        if (!stateRow) return htmlResponse("Invalid or expired state.", false);
        await admin.from("google_oauth_state").delete().eq("state", state);
        // 10 min expiry
        if (Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60_000) {
          return htmlResponse("State expired. Please try connecting again.", false);
        }

        const redirectUri = `${url.origin}/api/public/google/callback`;
        try {
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          if (!tokens.refresh_token) {
            return htmlResponse(
              "Google did not return a refresh token. Revoke the app in your Google account (myaccount.google.com/permissions) and try again.",
              false,
            );
          }
          const info = await fetchGoogleUserInfo(tokens.access_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          await admin
            .from("google_oauth_connection")
            .upsert(
              {
                id: 1,
                connected_by: stateRow.user_id,
                connected_email: info.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: expiresAt,
                scope: tokens.scope,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            );
          return htmlResponse(`Connected as ${info.email}. You can close this tab.`, true);
        } catch (e: any) {
          console.error("google callback failed", e);
          return htmlResponse(`Callback failed: ${e?.message ?? "unknown"}`, false);
        }
      },
    },
  },
});

function htmlResponse(msg: string, ok: boolean) {
  const color = ok ? "#16a34a" : "#dc2626";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Google Sheets</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;max-width:520px;margin:auto;text-align:center">
<h2 style="color:${color}">${ok ? "Connected" : "Not connected"}</h2>
<p>${msg}</p>
<script>try{window.opener&&window.opener.postMessage({type:'google-oauth',ok:${ok}}, '*');setTimeout(()=>window.close(),1500);}catch(e){}</script>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
