/**
 * The signed-in admin's own 2FA (NUMU-api /admin/auth/2fa/*).
 *
 * `require_admin_2fa` gates the sensitive admin decisions on a code verified
 * in the last few minutes. `verify` is both the last step of enrolment and the
 * step-up: a TOTP or backup code verified here unlocks gated actions briefly.
 */

import { apiClient } from "@/lib/apiClient";

export interface TwoFactorStatus {
  is_enabled: boolean;
  method: string | null;
  backup_codes_remaining: number;
  enabled_at: string | null;
  last_used_at: string | null;
}

export interface TwoFactorEnrolment {
  secret: string;
  /** otpauth:// URI: opens an authenticator app on a phone. */
  provisioning_uri: string;
  backup_codes: string[];
}

export function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return apiClient<TwoFactorStatus>("/admin/auth/2fa/status");
}

export function startTwoFactorEnrolment(): Promise<TwoFactorEnrolment> {
  return apiClient<TwoFactorEnrolment>("/admin/auth/2fa/enable", { method: "POST" });
}

export function verifyTwoFactor(code: string): Promise<{ verified: boolean }> {
  return apiClient<{ verified: boolean }>("/admin/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
