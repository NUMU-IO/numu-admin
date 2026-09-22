/**
 * The signed-in admin's two-factor authentication.
 *
 * Needed before NUMU_FORCE_ADMIN_2FA is turned on in production: that flag
 * makes theme, app and partner decisions, capability lifecycle and platform
 * settings refuse an admin without a recent 2FA check. Enrol here once; after
 * that the step-up prompt (TwoFactorStepUp) asks for a code when needed.
 *
 * ponytail: setup is by key, not a QR image. Every authenticator app accepts
 * "enter a setup key", and there are a handful of admins. Add a QR component
 * if that stops being true.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getTwoFactorStatus,
  startTwoFactorEnrolment,
  verifyTwoFactor,
  type TwoFactorEnrolment,
} from "@/services/twoFactorApi";

export default function Security() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["admin-2fa-status"], queryFn: getTwoFactorStatus });
  const [enrolment, setEnrolment] = useState<TwoFactorEnrolment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const s = status.data;

  return (
    <DashboardLayout title="Security" subtitle="Two-factor authentication for your admin account.">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>
              Approving themes, apps and partners, changing capabilities and platform
              settings will need a code from your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

            {s?.is_enabled && !enrolment && (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">On</p>
                <p className="text-muted-foreground">
                  Backup codes left: <span dir="ltr">{s.backup_codes_remaining}</span>
                </p>
                {s.last_used_at && (
                  <p className="text-muted-foreground">
                    Last used: <span dir="ltr">{new Date(s.last_used_at).toLocaleString()}</span>
                  </p>
                )}
              </div>
            )}

            {s && !s.is_enabled && !enrolment && (
              <Button
                disabled={busy}
                onClick={() => run(async () => setEnrolment(await startTwoFactorEnrolment()))}
              >
                Set up two-factor authentication
              </Button>
            )}

            {enrolment && (
              <div className="space-y-4 text-sm">
                <ol className="list-decimal space-y-2 ps-5">
                  <li>
                    In your authenticator app, add an account with this setup key (or{" "}
                    <a className="underline" href={enrolment.provisioning_uri}>
                      open it on this device
                    </a>
                    ):
                    <code
                      dir="ltr"
                      className="mt-1 block select-all rounded bg-muted px-3 py-2 font-mono tracking-wider"
                    >
                      {enrolment.secret}
                    </code>
                  </li>
                  <li>
                    Save these backup codes somewhere safe. Each works once if you lose your
                    phone, and they are not shown again:
                    <pre
                      dir="ltr"
                      className="mt-1 grid grid-cols-2 gap-x-6 rounded bg-muted px-3 py-2 font-mono"
                    >
                      {enrolment.backup_codes.join("\n")}
                    </pre>
                  </li>
                  <li>Enter the 6-digit code the app shows now:</li>
                </ol>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="max-w-40"
                  />
                  <Button
                    disabled={busy || !code.trim()}
                    onClick={() =>
                      run(async () => {
                        await verifyTwoFactor(code.trim());
                        setEnrolment(null);
                        setCode("");
                        await qc.invalidateQueries({ queryKey: ["admin-2fa-status"] });
                      })
                    }
                  >
                    Turn on
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
