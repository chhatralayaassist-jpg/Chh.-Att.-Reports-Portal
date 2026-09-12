import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { isPortalVerified } from "@/lib/portal-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Google identity alone is not enough — the portal password step must be done.
    if (!isPortalVerified()) throw redirect({ to: "/auth" });
    return { user: data.user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
