/**
 * The 2FA step-up prompt. Mounted once, next to the router.
 *
 * `require_admin_2fa` refuses a sensitive admin decision unless a code was
 * verified in the last few minutes. `apiClient` sees that 403, calls the
 * handler registered here, and retries the request once the admin has entered
 * a code. So every gated page gets the prompt without code of its own.
 *
 * An admin who hasn't enrolled can't be helped by a code: they are sent to
 * /security to set 2FA up, and the original request fails as before.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { setStepUpHandler } from "@/lib/apiClient";
import { verifyTwoFactor } from "@/services/twoFactorApi";

export function TwoFactorStepUp() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const settle = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setStepUpHandler((reason) => {
      if (/enroll/i.test(reason)) {
        navigate("/security");
        return Promise.resolve(false);
      }
      setCode("");
      setError(null);
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        settle.current = resolve;
      });
    });
    return () => setStepUpHandler(null);
  }, [navigate]);

  const finish = (ok: boolean) => {
    setOpen(false);
    settle.current?.(ok);
    settle.current = null;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyTwoFactor(code.trim());
      finish(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm it's you</DialogTitle>
          <DialogDescription>
            This action needs a fresh two-factor check. Enter the 6-digit code from
            your authenticator app, or one of your backup codes.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && code.trim() && !busy && submit()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !code.trim()}>
            Verify and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
