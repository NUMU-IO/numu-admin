/**
 * App review + App catalog admin API — /api/v1/admin/apps (apps plan, Phase 3).
 *
 * Review decisions, app suspension, the Partner-apps kill switch and NUMU App
 * pricing need the 2FA step-up; listing flags do not. Everything is written
 * to audit_logs.
 *
 * `@/lib/apiClient`, not `./api`: the 2FA step-up prompt and the reading of
 * the API's `error.message` envelope (numu-admin #91) live in that client.
 */

import { apiClient } from "@/lib/apiClient";

export type AppChangeType = "new_app" | "new_scopes" | "urls" | "pricing" | "listing_only";

export interface ReviewRow {
  version_id: string;
  app_id: string;
  slug: string;
  name: { ar?: string; en?: string };
  icon: string | null;
  partner: string | null;
  version: string;
  status: string;
  change_type: AppChangeType;
  submitted_at: string | null;
  age_days: number;
}

/** The subset of numu.app.json the review page reads. */
export interface AppManifest {
  name: { ar: string; en: string };
  tagline: { ar: string; en: string };
  description: { ar: string; en: string };
  icon: string;
  category: string;
  app_url: string;
  developer: {
    support_email: string;
    support_url?: string;
    privacy_policy_url?: string;
    terms_url?: string;
  };
  oauth: { redirect_urls: string[]; scopes: string[]; optional_scopes?: string[] };
  webhooks: { event: string; url: string }[];
  settings_schema: unknown[];
  /** `recurring` carries piasters and a cycle; `external` may carry a label. */
  pricing: {
    model: string;
    price_cents?: number;
    cycle?: "monthly" | "annual";
    label?: { ar: string; en: string };
    trial_days?: number;
    usage?: { unit: { ar: string; en: string }; price_cents?: number; cap_cents: number };
  };
  [key: string]: unknown;
}

/** `apps.manifest.pricing`: what the listing reads and app billing charges. */
export interface ListingPricing {
  plan: string;
  locales: { ar?: { label: string }; en?: { label: string } };
  price_cents?: number;
  cycle?: "monthly" | "annual";
  currency?: string;
}

export interface VersionDetail extends ReviewRow {
  manifest: AppManifest;
  published_manifest: AppManifest | null;
  release_notes: { ar?: string; en?: string } | null;
  review_notes: { ar?: string; en?: string } | null;
  review_checklist: Record<string, boolean> | null;
  checklist: Record<string, string>;
}

export interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  first_party: boolean;
  partner: string | null;
  status: "draft" | "published" | "suspended";
  version: string;
  category: string | null;
  listing_flags: { catalog_visible?: boolean; featured?: boolean; staff_pick?: boolean };
  installs_active: number;
  installs_total: number;
  /** Only when the catalog response carries it; NUMU-api #648 does not yet. */
  pricing?: ListingPricing | null;
}

export function listReviewQueue(): Promise<ReviewRow[]> {
  return apiClient<ReviewRow[]>("/admin/apps/review");
}

/** Opening a submitted version claims it (in_review). */
export function getVersion(versionId: string): Promise<VersionDetail> {
  return apiClient<VersionDetail>(`/admin/apps/versions/${versionId}`);
}

export function reviewAppVersion(
  versionId: string,
  body: {
    decision: "approve" | "request_changes" | "reject";
    checklist: Record<string, boolean>;
    notes_ar?: string;
    notes_en?: string;
  },
): Promise<ReviewRow> {
  return apiClient<ReviewRow>(`/admin/apps/versions/${versionId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listCatalog(): Promise<CatalogRow[]> {
  return apiClient<CatalogRow[]>("/admin/apps");
}

export function setListingFlags(
  appId: string,
  flags: CatalogRow["listing_flags"],
): Promise<CatalogRow["listing_flags"]> {
  return apiClient(`/admin/apps/${appId}/listing-flags`, {
    method: "PATCH",
    body: JSON.stringify(flags),
  });
}

export function suspendApp(
  appId: string,
  body: { suspend: boolean; reason?: string },
): Promise<{ status: string }> {
  return apiClient(`/admin/apps/${appId}/suspension`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Price a NUMU App. 409 for a Partner App (its price comes from its reviewed
 * manifest). Existing subscribers keep their price; new subscriptions pay this.
 */
export function setAppPricing(
  appId: string,
  body: { model: "free" } | { model: "recurring"; price_cents: number; cycle: "monthly" | "annual" },
): Promise<ListingPricing> {
  return apiClient(`/admin/apps/${appId}/pricing`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getKillSwitch(): Promise<{ enabled: boolean }> {
  return apiClient("/admin/apps/kill-switch");
}

export function setKillSwitch(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiClient("/admin/apps/kill-switch", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

// ─── Paid apps: subscriptions, revenue, charges, refunds ─────────────

export type AppSubStatus = "active" | "trial" | "past_due" | "cancelled";

export interface AdminAppSubscription {
  id: string;
  app_slug: string;
  app_name: string;
  store_id: string;
  store_name: string | null;
  tenant_id: string;
  status: AppSubStatus;
  price_cents: number;
  currency: string;
  cycle: "monthly" | "annual";
  usage_cap_cents: number | null;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
}

export function listAppSubscriptions(filter: {
  status?: AppSubStatus;
  app?: string;
  store_id?: string;
}): Promise<AdminAppSubscription[]> {
  const q = new URLSearchParams(
    Object.entries(filter).filter((e): e is [string, string] => Boolean(e[1])),
  );
  return apiClient<AdminAppSubscription[]>(`/admin/apps/subscriptions?${q}`);
}

export interface RevenueMonth {
  month: string;
  gross_cents: number;
  /** 14% VAT on NUMU's fee, inside gross; NUMU's figure excludes it. */
  vat_cents: number;
  partner_cents: number;
  numu_cents: number;
}

export interface AppRevenue {
  currency: string;
  months: RevenueMonth[];
  totals: Omit<RevenueMonth, "month">;
}

export function getAppRevenue(months = 12): Promise<AppRevenue> {
  return apiClient<AppRevenue>(`/admin/apps/revenue?months=${months}`);
}

export interface AppCharge {
  id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  note: string | null;
  created_at: string;
  refunded: boolean;
}

export function listAppCharges(): Promise<AppCharge[]> {
  return apiClient<AppCharge[]>("/admin/apps/charges");
}

/**
 * Refunds an app charge in full: the merchant's wallet gets it back and the
 * partner's 80% is reversed. 2FA. A second refund of the same charge is a
 * no-op (`refunded: false`).
 */
export function refundAppCharge(
  chargeId: string,
  note: string,
): Promise<{ refunded: boolean; amount_cents?: number; partner_adjustment_cents?: number }> {
  return apiClient(`/admin/apps/charges/${chargeId}/refund`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
