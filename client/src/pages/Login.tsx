/**
 * Sign in — the one brand moment in the backoffice.
 *
 * Navy plate on the inline start, form card on the end. The plate is flat
 * Navy with a single Souk tile strip along its foot: the design system
 * allows the motif as a border or framing device and nothing else, and it
 * bans gradients outright, so the radial blue glow this page used to carry
 * is gone.
 *
 * Below 900px the plate drops out and the card grows a compact brand row, so
 * the page is never logo-less.
 */

import { Button, FormField, IconButton, Input, SoukDivider, Wordmark } from "@/ds";
import { login } from "@/services/authService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    mutationFn: (creds: { email: string; password: string }) =>
      login(creds.email, creds.password),
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
      navigate("/");
    },
    onError: (err: Error) =>
      setError(err.message || "Sign in failed. Check the address and password."),
  });

  return (
    <div className="ak-auth">
      <aside className="ak-auth__plate">
        <div className="ak-auth__brand">
          <Wordmark size={30} tone="cream" />
          <span className="numu-label ak-auth__kicker">Admin backoffice</span>
        </div>

        <div className="ak-auth__pitch">
          <p className="numu-label ak-auth__kicker">Platform access</p>
          <h1 className="ak-auth__headline">
            One signed-in seat for the whole platform.
          </h1>
          <p className="ak-auth__body">
            Merchant accounts, beta invites, reconciliation, theme assignments —
            every operator action lives behind this sign-in. Sessions last 7 days
            and refresh while you work.
          </p>
        </div>

        <div className="ak-auth__foot">
          <SoukDivider
            tone="navy"
            height={36}
            opacity={0.3}
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <span className="numu-mono ak-auth__legal">numueg.app · internal</span>
        </div>
      </aside>

      <main className="ak-auth__panel">
        <div className="ak-auth__card ncd">
          <div className="ak-auth__brand ak-auth__brand--compact">
            <Wordmark size={26} tone="navy" />
            <span className="numu-label">Admin backoffice</span>
          </div>

          <p className="numu-label" style={{ color: "var(--accent)" }}>
            Admin access
          </p>
          <h2 className="ak-auth__title">Sign in</h2>
          <p className="ak-auth__sub">
            Use your platform-admin credentials. An existing operator grants
            access.
          </p>

          <form
            noValidate
            className="ak-auth__form"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              loginMutation.mutate({ email, password });
            }}
          >
            <FormField label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@numueg.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginMutation.isPending}
                error={Boolean(error)}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              required
              error={error ?? undefined}
            >
              <div className="ak-auth__password">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                  error={Boolean(error)}
                />
                <IconButton
                  icon={showPassword ? "eyeOff" : "eye"}
                  label={showPassword ? "Hide password" : "Show password"}
                  size="sm"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                />
              </div>
            </FormField>

            <Button
              type="submit"
              block
              iconEnd="arrowRight"
              loading={loginMutation.isPending}
              disabled={!email || !password}
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="ak-auth__note">
          Sessions last 7 days and refresh automatically while you work.
        </p>
      </main>
    </div>
  );
}
