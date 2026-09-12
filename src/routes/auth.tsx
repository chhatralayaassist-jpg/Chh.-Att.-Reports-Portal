import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth, useMyRoles } from "@/hooks/use-auth";
import { useHydrated } from "@/hooks/use-hydrated";
import { checkEmailRegistered } from "@/lib/auth-lookup.functions";
import { PORTAL_VERIFIED_KEY } from "@/lib/portal-session";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
const appLogo = { url: "/favicon.png" };

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Chhatralaya Attendance" },
      { name: "description", content: "Sign in with your registered Google account and portal password to access the Chhatralaya attendance portal." },
      { property: "og:title", content: "Sign in — Chhatralaya Attendance" },
      { property: "og:description", content: "Sign in with your registered Google account and portal password to access the Chhatralaya attendance portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Sign in — Chhatralaya Attendance" },
      { name: "twitter:description", content: "Sign in with your registered Google account and portal password to access the Chhatralaya attendance portal." },
    ],
  }),
  component: AuthPage,
});


type Step = "start" | "password" | "not-registered";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: roles } = useMyRoles();
  const verifyEmail = useServerFn(checkEmailRegistered);

  const [step, setStep] = useState<Step>("start");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(false);
  const [verified, setVerified] = useState(false);
  const hydrated = useHydrated();

  const portalVerified = () =>
    typeof window !== "undefined" && localStorage.getItem(PORTAL_VERIFIED_KEY) === "1";

  // Route the user onward only after the portal password step is completed.
  useEffect(() => {
    if (loading || !user || !roles || !portalVerified()) return;
    navigate({ to: "/notices" });
  }, [user, loading, roles, navigate, verified]);

  // A Google account is signed in on this device — check if it is registered here.
  useEffect(() => {
    if (loading || !user || portalVerified()) return;
    const email = (user.email ?? "").toLowerCase();
    if (!email) return;
    let cancelled = false;
    setCheckingGoogle(true);
    verifyEmail({ data: { email } })
      .then((res) => {
        if (cancelled) return;
        if (res.exists) {
          setVerifiedEmail(email);
          setStep("password");
        } else {
          setVerifiedEmail(email);
          setStep("not-registered");
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not verify this Google account");
      })
      .finally(() => !cancelled && setCheckingGoogle(false));
    return () => {
      cancelled = true;
    };
  }, [user, loading, verifyEmail]);

  const useAnotherGoogle = useCallback(async () => {
    setBusy(true);
    try {
      localStorage.removeItem(PORTAL_VERIFIED_KEY);
      await supabase.auth.signOut();
      setStep("start");
      setVerifiedEmail("");
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
        extraParams: { prompt: "select_account" },
      });
    } catch {
      toast.error("Could not switch Google account");
    } finally {
      setBusy(false);
    }
  }, []);

const signInWithGoogle = async () => {
  setBusy(true);

  try {
    localStorage.removeItem(PORTAL_VERIFIED_KEY);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
  } catch (err: any) {
    console.error("Google sign-in error:", err);
    toast.error(err?.message ?? "Google sign-in failed");
  } finally {
    setBusy(false);
  }
};

  if (!hydrated) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: verifiedEmail, password });
      if (error) throw error;
      localStorage.setItem(PORTAL_VERIFIED_KEY, "1");
      setVerified(true);
      toast.success("Welcome back.");
      navigate({ to: "/notices" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Step, string> = {
    start: "Sign in",
    password: "Enter your portal password",
    "not-registered": "Account not registered",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={appLogo.url}
            alt="Chhatralaya Attendance Portal logo"
            className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover shadow-lg"
          />

          <h1 className="text-3xl font-bold tracking-tight text-foreground">Chhatralaya Attendance Portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">Daily register · QR scan · Reports</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>{titles[step]}</CardTitle>
            <CardDescription>
              {step === "start" && "Step 1 — continue with your Google account. It works on any device."}
              {step === "password" && "Step 2 — your email is verified, now enter the portal password."}
              {step === "not-registered" && "This Google account cannot be used to sign in here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkingGoogle && step === "start" ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : step === "start" ? (
              <div className="space-y-4">
                <Button className="w-full" disabled={busy} onClick={signInWithGoogle}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue with Google
                </Button>
              </div>
            ) : step === "not-registered" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div>
                    <p className="font-medium text-foreground">
                      This Google account is not registered on the Chhatralaya Portal.
                    </p>
                    <p className="mt-1 truncate text-muted-foreground">{verifiedEmail}</p>
                  </div>
                </div>
                <Button className="w-full" disabled={busy} onClick={useAnotherGoogle}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Use another Google Account
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="truncate text-foreground">{verifiedEmail}</span>
                </div>
                <div>
                  <Label htmlFor="password">Portal Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={async () => {
                    setPassword("");
                    localStorage.removeItem(PORTAL_VERIFIED_KEY);
                    await supabase.auth.signOut();
                    setStep("start");
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Use a different account
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
