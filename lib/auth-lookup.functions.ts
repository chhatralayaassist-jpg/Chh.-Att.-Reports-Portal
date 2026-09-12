import { createServerFn } from "@tanstack/react-start";

/**
 * Step 1 of sign-in: confirm the typed email belongs to a registered account
 * before the password field is shown.
 */
export const checkEmailRegistered = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Enter a valid email address");
    return { email };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { exists: !!row };
  });
