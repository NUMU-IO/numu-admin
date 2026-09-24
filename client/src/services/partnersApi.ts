/**
 * Partner program admin API — /api/v1/admin/partners (apps plan, Phase 2;
 * the billing switch and the partner ledger, Phase 7).
 *
 * Every write (open/close the program, approve, reject, suspend, reinstate,
 * billing, payouts, adjustments) needs the 2FA step-up and lands in
 * audit_logs. Notes the partner reads are sent in Arabic and English. An
 * illegal transition comes back as a 409 whose message apiClient re-throws
 * as the Error message.
 *
 * `@/lib/apiClient`, not `./api`: the 2FA step-up prompt and the reading of
 * the API's `error.message` envelope (numu-admin #91) live in that client.
 */

import { apiClient, getApiBase } from "@/lib/apiClient";

export type PartnerStatus = "pending" | "approved" | "rejected" | "suspended";

export interface AdminPartner {
  id: string;
  user_id: string;
  user_email: string;
  email_verified: boolean;
  kind: "individual" | "company";
  display_name: string;
  legal_name: string | null;
  country: string;
  website_url: string | null;
  support_email: string;
  support_phone: string | null;
  status: PartnerStatus;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
  review_notes: { ar?: string; en?: string } | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  dev_store_count: number;
  theme_count: number;
  /** Added by NUMU-api #695: referral terms and the public directory listing. */
  referral_bps?: number;
  referral_months?: number;
  directory_listed?: boolean;
  verified?: boolean;
  directory_hidden?: boolean;
}

export function listPartners(status?: PartnerStatus): Promise<AdminPartner[]> {
  return apiClient<AdminPartner[]>(`/admin/partners${status ? `?status=${status}` : ""}`);
}

export function getProgram(): Promise<{ enabled: boolean }> {
  return apiClient<{ enabled: boolean }>("/admin/partners/program");
}

export function setProgram(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiClient<{ enabled: boolean }>("/admin/partners/program", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

/**
 * NUMU billing for Partner Apps (draft Partner Agreement § 11.1). Off:
 * partners may publish only free or external apps. PUT needs 2FA.
 */
export function getPartnerBilling(): Promise<{ enabled: boolean }> {
  return apiClient<{ enabled: boolean }>("/admin/partners/billing");
}

export function setPartnerBilling(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiClient<{ enabled: boolean }>("/admin/partners/billing", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

/** One ledger row. Money is signed piasters: sales +, payouts −, adjustments either way. */
export interface LedgerEntry {
  id: string;
  kind: "sale" | "referral" | "payout" | "adjustment";
  amount_cents: number;
  /** Sales only: what the merchant paid, and the 20% NUMU kept. */
  gross_cents: number | null;
  platform_fee_cents: number | null;
  currency: string;
  app_id: string | null;
  /** Sales: the wallet charge it came from, which a refund names. */
  charge_id?: string | null;
  /** Added by NUMU-api #656; null on payouts and adjustments, which have no app. */
  app_name?: string | null;
  app_slug?: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
}

export interface PartnerLedger {
  /** What NUMU owes the partner: the sum of every entry. */
  balance_cents: number;
  /** The balance minus sales still inside the 30-day hold. */
  payable_cents: number;
  currency: string;
  /** Newest first; the API returns the latest 100. */
  entries: LedgerEntry[];
}

export function getLedger(partnerId: string): Promise<PartnerLedger> {
  return apiClient<PartnerLedger>(`/admin/partners/${partnerId}/ledger`);
}

type Recorded = { entry: LedgerEntry; balance_cents: number };

/**
 * Records a bank transfer ALREADY sent to the partner; NUMU moves no money.
 * 2FA. 409 when it exceeds what is payable or the reference is already used.
 */
export function recordPayout(
  partnerId: string,
  body: { amount_cents: number; reference: string; note?: string },
): Promise<Recorded> {
  return apiClient<Recorded>(`/admin/partners/${partnerId}/payouts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * A signed correction to what NUMU owes, e.g. −(partner's share) of a charge
 * refunded to a merchant. 2FA. 409 when the reference is already used.
 */
export function recordAdjustment(
  partnerId: string,
  body: { amount_cents: number; reference: string; note: string },
): Promise<Recorded> {
  return apiClient<Recorded>(`/admin/partners/${partnerId}/adjustments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function decidePartner(
  id: string,
  body: { decision: "approve" | "reject"; notes_ar?: string; notes_en?: string },
): Promise<AdminPartner> {
  return apiClient<AdminPartner>(`/admin/partners/${id}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function suspendPartner(
  id: string,
  body: { suspend: boolean; reason_ar?: string; reason_en?: string },
): Promise<AdminPartner> {
  return apiClient<AdminPartner>(`/admin/partners/${id}/suspension`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface ReferredStore {
  tenant_id: string;
  store_name: string;
  signed_up_at: string;
  plan: string;
  status: string;
  first_paid_at: string | null;
  earned_cents: number;
}

export interface PartnerReferrals {
  code: string;
  referral_bps: number;
  referral_months: number;
  stores: ReferredStore[];
}

export function getReferrals(partnerId: string): Promise<PartnerReferrals> {
  return apiClient<PartnerReferrals>(`/admin/partners/${partnerId}/referrals`);
}

/** The partner's share of referred merchants' plan payments. 2FA. */
export function setReferralTerms(
  partnerId: string,
  body: { referral_bps: number; referral_months: number },
): Promise<AdminPartner> {
  return apiClient<AdminPartner>(`/admin/partners/${partnerId}/referral-terms`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Attribute a store to this partner, replacing any earlier referrer. 2FA. */
export function assignReferral(partnerId: string, subdomain: string): Promise<{ stores: ReferredStore[] }> {
  return apiClient<{ stores: ReferredStore[] }>(`/admin/partners/${partnerId}/referrals`, {
    method: "POST",
    body: JSON.stringify({ subdomain }),
  });
}

export function removeReferral(partnerId: string, tenantId: string): Promise<{ stores: ReferredStore[] }> {
  return apiClient<{ stores: ReferredStore[] }>(`/admin/partners/${partnerId}/referrals/${tenantId}`, {
    method: "DELETE",
  });
}

/** Grant/revoke the Verified badge, hide/restore the public profile. 2FA. */
export function setDirectoryFlags(
  partnerId: string,
  body: { verified?: boolean; directory_hidden?: boolean },
): Promise<AdminPartner> {
  return apiClient<AdminPartner>(`/admin/partners/${partnerId}/directory`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export interface PartnerStatement {
  month: string;
  currency: string;
  opening_balance_cents: number;
  gross_sales_cents: number;
  platform_fees_cents: number;
  net_sales_cents: number;
  /** Signed as they move the balance: refunds and payouts are negative. */
  refunds_cents: number;
  adjustments_cents: number;
  payouts_cents: number;
  closing_balance_cents: number;
  entries: {
    id: string;
    kind: "sale" | "refund" | "adjustment" | "payout";
    amount_cents: number;
    app_name: string | null;
    reference: string | null;
    created_at: string;
  }[];
}

/** One month (`YYYY-MM`, UTC) of a partner's ledger, as the partner sees it. */
export function getStatement(partnerId: string, month: string): Promise<PartnerStatement> {
  return apiClient<PartnerStatement>(`/admin/partners/${partnerId}/statements?month=${month}`);
}

/** The same statement as a CSV file download. */
export async function downloadStatementCsv(partnerId: string, month: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/admin/partners/${partnerId}/statements/${month}.csv`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Statement download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `partner-statement-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export type NoticeKind = "changelog" | "deprecation";

export interface PartnerNotice {
  notice_id: string;
  notice_kind: NoticeKind;
  title: { ar: string; en: string };
  body: { ar: string; en: string };
  link: string | null;
  created_at: string;
  recipients: number;
}

export function listNotices(): Promise<PartnerNotice[]> {
  return apiClient<PartnerNotice[]>("/admin/partners/notices");
}

export function postNotice(body: {
  notice_kind: NoticeKind;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  link?: string;
}): Promise<{ notice_id: string; recipients: number }> {
  return apiClient("/admin/partners/notices", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
