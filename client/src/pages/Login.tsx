/**
 * Login Page — NUMU Admin Backoffice
 *
 * Split-panel layout matching the merchant hub's auth page in spirit
 * (brand panel left, form card right, editorial typography) but kept
 * lean for the admin: no Ballpit/WebGL, no rotating taglines, no
 * Google OAuth, no 2FA flow, no i18n. Pure email/password against
 * ``/api/v1/admin/auth/login``.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/services/authService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: async (user) => {
      queryClient.setQueryData(["auth", "me"], user);
      navigate("/");
    },
    onError: (err: Error) => {
      setError(err.message || "An unexpected error occurred. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Brand panel (left) ─────────────────────────────────
          Visible on lg+ only. On smaller viewports it collapses
          and the form gets a compact brand row at the top of its
          card so the page never feels logo-less. */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative bg-slate-900 text-slate-100 flex-col justify-between p-12 overflow-hidden">
        {/* Subtle radial gradient backdrop — keeps the navy from
            feeling like a flat block. Using inline style because
            the gradient stops are bespoke to this page. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 80% 100%, rgba(99,102,241,0.18), transparent 55%)",
          }}
        />

        {/* Brand mark */}
        <div className="relative flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <ShieldCheck className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.28em] uppercase text-slate-400">
              NUMU
            </p>
            <p className="text-sm font-semibold tracking-tight">
              Admin Backoffice
            </p>
          </div>
        </div>

        {/* Editorial copy */}
        <div className="relative max-w-md">
          <p className="text-[11px] tracking-[0.28em] uppercase text-blue-300 mb-4">
            § PLATFORM ACCESS
          </p>
          <h1 className="text-3xl xl:text-[2.25rem] font-bold leading-[1.15] tracking-tight">
            One signed-in seat for the whole platform.
          </h1>
          <div className="my-5 h-px w-12 bg-blue-300/60" />
          <p className="text-sm leading-relaxed text-slate-300/80">
            Merchant accounts, beta invites, reconciliation, theme
            assignments — every operator action lives behind this
            single sign-in. Sessions last 7 days and auto-refresh as
            you work.
          </p>
        </div>

        {/* Footer line */}
        <div className="relative flex items-center gap-3 text-[11px] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-blue-300/70" />
          <span>&copy; 2026 numu</span>
          <span aria-hidden="true">·</span>
          <span>numueg.app</span>
        </div>
      </div>

      {/* ── Form panel (right) ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-xl border border-border bg-card shadow-sm p-7 sm:p-9">
            {/* Mobile brand row — only shown when the side panel
                is hidden. Keeps the page from feeling unbranded
                on phones. */}
            <div className="lg:hidden mb-6 flex items-center gap-2.5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                  NUMU
                </p>
                <p className="text-sm font-semibold tracking-tight">
                  Admin Backoffice
                </p>
              </div>
            </div>

            <p className="text-[11px] tracking-[0.28em] uppercase text-primary mb-3">
              § ADMIN ACCESS
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              Sign in
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground mb-7">
              Use your platform-admin credentials. Need access? Reach
              out to an existing operator.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@numueg.app"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="h-11 pr-10 [&::-ms-reveal]:hidden"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2.5"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 gap-2"
                disabled={loginMutation.isPending || !email || !password}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-[11px] text-center text-muted-foreground">
            Sessions last 7 days and refresh automatically while you work.
          </p>
        </div>
      </div>
    </div>
  );
}
