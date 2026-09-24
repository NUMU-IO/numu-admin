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

export type ReviewSubject = "version" | "listing" | "version_listing";

export interface ReviewRow {
  review_id: string;
  round: number;
  app_id: string;
  slug: string;
  name: { ar?: string; en?: string };
  icon: string | null;
  partner: string | null;
  subject: ReviewSubject;
  version: string | null;
  version_id: string | null;
  listing_id: string | null;
  status: string;
  change_type: AppChangeType;
  submitted_at: string | null;
  age_days: number;
  business_days_waiting: number;
  due_at: string | null;
  overdue: boolean;
  name_change: boolean;
}

export interface Bilingual {
  ar: string;
  en: string;
}

export interface ListingContent {
  name: Bilingual;
  tagline: Bilingual;
  description: Bilingual;
  screenshots: { src: string; caption?: Bilingual }[];
  video_url: string | null;
  category: string;
  keywords: { ar: string[]; en: string[] };
}

export interface ReviewRound {
  review_id: string;
  round: number;
  subject: ReviewSubject;
  version: string | null;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  reviewer: string | null;
  checklist: Record<string, boolean> | null;
  notes: { ar?: string; en?: string } | null;
  internal_note: string | null;
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

export interface ReviewDetail extends Omit<ReviewRow, "name_change"> {
  manifest: AppManifest | null;
  published_manifest: AppManifest | null;
  release_notes: { ar?: string; en?: string } | null;
  listing: ListingContent | null;
  live_listing: ListingContent;
  name_change: { from: Bilingual; to: Bilingual } | null;
  checklist: Record<string, string>;
  required_checks: string[];
  history: ReviewRound[];
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

/** Opening a submitted review claims it (in_review). */
export function getReview(reviewId: string): Promise<ReviewDetail> {
  return apiClient<ReviewDetail>(`/admin/apps/reviews/${reviewId}`);
}

export function decideReview(
  reviewId: string,
  body: {
    decision: "approve" | "request_changes" | "reject";
    checklist: Record<string, boolean>;
    notes_ar?: string;
    notes_en?: string;
    internal_note?: string;
  },
): Promise<ReviewRow> {
  return apiClient<ReviewRow>(`/admin/apps/reviews/${reviewId}/decision`, {
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
