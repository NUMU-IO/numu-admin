/**
 * Subscription-payment admin service (InstaPay plan payments).
 *
 * Wraps `/admin/subscription-payments*` — the review queue for merchant
 * plan payments made by InstaPay transfer + receipt upload:
 *
 *   GET  /admin/subscription-payments?status → { proofs, counts }
 *   POST /admin/subscription-payments/{id}/approve  → activates/renews
 *   POST /admin/subscription-payments/{id}/reject   {reason}
 *
 * Same shape as the wallet top-up queue (walletAdminApi.ts) — approval
 * here activates a subscription instead of crediting a wallet.
 * Money is integer cents everywhere.
 */

import { apiClient } from "./api";

export type SubscriptionProofStatus =
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "auto_approved";

export interface SubscriptionProofItem {
  proof_id: string;
  tenant_id: string;
  tenant_name: string | null;
  intent_id: string;
  plan: string;
  billing_cycle: "monthly" | "annual";
  purpose: "new_subscription" | "renewal";
  amount_cents: number;
  reference: string;
  destination: string | null;
  transaction_ref: string;
  declared_amount_cents: number | null;
  status: SubscriptionProofStatus;
  block_reasons: string[] | null;
  ocr_status: string | null;
  ocr_extracted_amount_cents: number | null;
  ocr_extracted_ipa: string | null;
  ocr_extracted_note: string | null;
  rejection_reason: string | null;
  image_url: string | null;
  created_at: string | null;
}

export interface SubscriptionProofListResponse {
  proofs: SubscriptionProofItem[];
  counts: Partial<Record<SubscriptionProofStatus, number>>;
}

export function listSubscriptionProofs(
  status: SubscriptionProofStatus = "awaiting_review",
): Promise<SubscriptionProofListResponse> {
  return apiClient<SubscriptionProofListResponse>(
    `/admin/subscription-payments?status=${encodeURIComponent(status)}`,
  );
}

export interface SubscriptionProofActionResult {
  proof_id: string;
  status: string;
  activated?: boolean;
  plan?: string;
  billing_cycle?: string;
}

export function approveSubscriptionProof(
  proofId: string,
): Promise<SubscriptionProofActionResult> {
  return apiClient<SubscriptionProofActionResult>(
    `/admin/subscription-payments/${proofId}/approve`,
    { method: "POST" },
  );
}

export function rejectSubscriptionProof(
  proofId: string,
  reason: string,
): Promise<SubscriptionProofActionResult> {
  return apiClient<SubscriptionProofActionResult>(
    `/admin/subscription-payments/${proofId}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

// ─── Lifecycle settings (warnings + dunning) ─────────────────────────────

export interface BillingLifecycleSettings {
  /** Master switch for the pre-expiry warning emails. */
  warning_emails_enabled: boolean;
  /** Days before next_renewal_at the merchant is warned (also the hub's
   * "renewal due — pay now" window). */
  renewal_warning_days: number;
  /** Days before trial expires_at the merchant is warned. */
  trial_warning_days: number;
  /** Failed renewal attempts before the store goes read-only. */
  dunning_max_retries: number;
  /** Hours between renewal retry attempts. */
  dunning_retry_backoff_hours: number;
  /** Minimum hours since subscription start before read-only can trigger. */
  dunning_window_hours: number;
}

export type BillingLifecyclePatch = Partial<BillingLifecycleSettings>;

export function getBillingLifecycleSettings(): Promise<BillingLifecycleSettings> {
  return apiClient<BillingLifecycleSettings>(
    "/admin/subscription-payments/settings",
  );
}

export function updateBillingLifecycleSettings(
  patch: BillingLifecyclePatch,
): Promise<BillingLifecycleSettings> {
  return apiClient<BillingLifecycleSettings>(
    "/admin/subscription-payments/settings",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}
