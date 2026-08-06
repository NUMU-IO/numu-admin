/**
 * Merchant-wallet admin service (pay-as-you-go tier).
 *
 * Wraps `/admin/wallets*` — super-admin control over the prepaid wallet
 * system that funds the payg commission model:
 *
 *   GET  /admin/wallets/settings            → effective WalletAdminSettings
 *   PUT  /admin/wallets/settings            → partial patch (null clears an
 *                                             override back to env default)
 *   GET  /admin/wallets/topup-proofs?status → { proofs, counts } review queue
 *   POST /admin/wallets/topup-proofs/{id}/approve | /reject {reason}
 *   GET  /admin/wallets                     → wallet list (worst balance first)
 *   GET  /admin/wallets/{tenant_id}         → wallet + recent ledger
 *   POST /admin/wallets/{tenant_id}/adjust  {amount_cents, note}
 *   PATCH /admin/wallets/{tenant_id}/config {status?, commission_bps_override?,
 *                                            clear_commission_override?,
 *                                            negative_allowance_cents?}
 *
 * Money is integer cents everywhere; rates are basis points (100 = 1%).
 */

import { apiClient } from "./api";

// ─── Settings ────────────────────────────────────────────────────────────────

export interface WalletAdminSettings {
  topups_enabled: boolean;
  checkout_gate_enabled: boolean;
  /** New tenants can't take orders until they pick a plan / Pay as you Grow. */
  golive_gate_enabled: boolean;
  card_enabled: boolean;
  vodafone_cash_enabled: boolean;
  instapay_enabled: boolean;
  commission_bps_default: number | null;
  negative_allowance_cents: number;
  low_balance_threshold_cents: number;
  /** Admin-controlled minimum a merchant can top up (integer cents). */
  min_topup_cents: number;
  vodafone_cash_number: string | null;
  instapay_ipa: string | null;
  instapay_display_name: string | null;
  /** Per-method platform configuration status (GET only): VC number /
   * InstaPay IPA saved here, Kashier creds on the server env. */
  methods_configured?: Record<"card" | "vodafone_cash" | "instapay", boolean>;
  /** enabled AND configured — what merchants are actually offered (GET only). */
  effective_methods?: Record<"card" | "vodafone_cash" | "instapay", boolean>;
}

export type WalletSettingsPatch = Partial<
  Omit<WalletAdminSettings, "methods_configured" | "effective_methods">
>;

export function getWalletSettings(): Promise<WalletAdminSettings> {
  return apiClient<WalletAdminSettings>("/admin/wallets/settings");
}

export function updateWalletSettings(
  patch: WalletSettingsPatch,
): Promise<WalletAdminSettings> {
  return apiClient<WalletAdminSettings>("/admin/wallets/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

// ─── Top-up proof review queue ───────────────────────────────────────────────

export type ProofStatus =
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "auto_approved";

export interface TopupProofItem {
  proof_id: string;
  tenant_id: string;
  tenant_name: string | null;
  topup_id: string;
  method: "vodafone_cash" | "instapay" | "card";
  amount_cents: number;
  reference: string;
  destination: string | null;
  transaction_ref: string;
  declared_amount_cents: number | null;
  status: ProofStatus;
  block_reasons: string[] | null;
  ocr_status: string | null;
  ocr_extracted_amount_cents: number | null;
  ocr_extracted_ipa: string | null;
  ocr_extracted_note: string | null;
  rejection_reason: string | null;
  image_url: string | null;
  created_at: string | null;
}

export interface TopupProofListResponse {
  proofs: TopupProofItem[];
  counts: Partial<Record<ProofStatus, number>>;
}

export function listTopupProofs(
  status: ProofStatus = "awaiting_review",
): Promise<TopupProofListResponse> {
  return apiClient<TopupProofListResponse>(
    `/admin/wallets/topup-proofs?status=${encodeURIComponent(status)}`,
  );
}

export interface ProofActionResult {
  proof_id: string;
  status: string;
  credited_balance_cents?: number | null;
}

export function approveTopupProof(proofId: string): Promise<ProofActionResult> {
  return apiClient<ProofActionResult>(
    `/admin/wallets/topup-proofs/${proofId}/approve`,
    { method: "POST" },
  );
}

export function rejectTopupProof(
  proofId: string,
  reason: string,
): Promise<ProofActionResult> {
  return apiClient<ProofActionResult>(
    `/admin/wallets/topup-proofs/${proofId}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

// ─── Wallet list / detail / adjust / config ──────────────────────────────────

export interface AdminWalletItem {
  id: string;
  tenant_id: string;
  tenant_name?: string | null;
  balance_cents: number;
  pending_balance_cents: number;
  currency: string;
  status: "active" | "suspended" | "exempt";
  commission_bps_override: number | null;
  negative_allowance_cents: number | null;
  last_warning_level: number;
  created_at: string | null;
}

export interface AdminWalletLedgerEntry {
  id: string;
  kind: string;
  amount_cents: number;
  balance_after_cents: number;
  order_id: string | null;
  idempotency_key: string | null;
  actor_user_id: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
  created_at: string | null;
}

export function listWallets(): Promise<AdminWalletItem[]> {
  return apiClient<AdminWalletItem[]>("/admin/wallets?limit=200");
}

export function getWalletDetail(
  tenantId: string,
): Promise<AdminWalletItem & { ledger: AdminWalletLedgerEntry[] }> {
  return apiClient(`/admin/wallets/${tenantId}`);
}

export function adjustWallet(
  tenantId: string,
  amountCents: number,
  note: string,
): Promise<{ transaction_id: string | null; balance_after_cents: number | null }> {
  return apiClient(`/admin/wallets/${tenantId}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount_cents: amountCents, note }),
  });
}

export interface WalletConfigPatch {
  status?: "active" | "suspended" | "exempt";
  commission_bps_override?: number;
  clear_commission_override?: boolean;
  negative_allowance_cents?: number;
}

export function updateWalletConfig(
  tenantId: string,
  patch: WalletConfigPatch,
): Promise<AdminWalletItem> {
  return apiClient<AdminWalletItem>(`/admin/wallets/${tenantId}/config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
