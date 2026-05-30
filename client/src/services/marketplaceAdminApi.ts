/**
 * Marketplace admin review service.
 *
 * Wraps `/marketplace/admin/*` — the super-admin moderation endpoints
 * that gate every theme version before it lands in the public catalog.
 *
 * Two routes only:
 *
 *   GET  /marketplace/admin/pending
 *     → list versions awaiting review (developer name + theme slug +
 *       version_string + bundle_url + submitted_at).
 *
 *   POST /marketplace/admin/versions/{version_id}/review
 *     { decision: "approve" | "reject" | "request_changes", notes?: string }
 *     → moderation decision. Approval flips the version to "published"
 *       and makes it visible in the public catalog within ~1 minute
 *       (CDN warm-up).
 *
 * The review endpoint is gated by `require_admin_2fa(max_age_seconds=300)`
 * — the admin must have re-verified MFA in the last 5 minutes. Stale
 * sessions can't ship third-party JS storewide.
 */

import { apiClient } from "./api";

export type ReviewDecision = "approve" | "reject" | "request_changes";

export interface PendingThemeVersion {
  version_id: string;
  marketplace_theme_id: string;
  theme_name: string;
  theme_slug: string;
  version_string: string;
  release_notes: string | null;
  developer_id: string;
  developer_name: string | null;
  developer_email: string | null;
  bundle_url: string | null;
  css_url: string | null;
  source_zip_path: string | null;
  submitted_at: string;
  /** Build status — versions only enter the review queue once their
   *  build artifact is uploaded; this should always be "approved" but
   *  carries through from the build pipeline for debugging. */
  build_status: string;
}

export interface PendingReviewListResponse {
  pending: PendingThemeVersion[];
}

export interface ReviewDecisionRequest {
  decision: ReviewDecision;
  notes?: string;
}

export interface ReviewDecisionResponse {
  version_id: string;
  decision: ReviewDecision;
  new_status: string;
  reviewed_at: string;
}

export function listPendingReviews(): Promise<PendingReviewListResponse> {
  return apiClient<PendingReviewListResponse>("/marketplace/admin/pending");
}

export function reviewVersion(
  versionId: string,
  body: ReviewDecisionRequest,
): Promise<ReviewDecisionResponse> {
  return apiClient<ReviewDecisionResponse>(
    `/marketplace/admin/versions/${versionId}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ─── Phase 1 soft-migration: per-theme feature flags ────────────────────────

/**
 * Per-theme feature flags read by the catalog endpoint. Default `{}` ⇒
 * theme is INVISIBLE. Admin flips these here to roll out gradually
 * without redeploying. Every field is optional in PATCH semantics.
 */
export interface ThemeFlags {
  catalog_visible?: boolean;
  installable?: boolean;
  activatable?: boolean;
  visible_to_user_ids?: string[];
  /** 0-100. Stable hash of (user_id, theme_slug) mod 100 < pct gates
   *  the user out. Bypassed for users in `visible_to_user_ids`. */
  visible_to_pct?: number;
}

export interface AdminThemeListItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  price_cents: number;
  flags: ThemeFlags;
  install_count: number;
  created_at: string;
}

export interface AdminThemeListResponse {
  themes: AdminThemeListItem[];
}

export function listAdminThemes(): Promise<AdminThemeListResponse> {
  return apiClient<AdminThemeListResponse>("/marketplace/admin/themes");
}

/** PATCH semantics — only fields in `patch` are touched on the server. */
export function updateThemeFlags(
  themeId: string,
  patch: ThemeFlags,
): Promise<AdminThemeListItem> {
  return apiClient<AdminThemeListItem>(
    `/marketplace/admin/themes/${themeId}/flags`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

// ─── Session B (2026-05-28): admin metadata editor ─────────────────────────
//
// Wraps PATCH /api/v1/marketplace/admin/themes/{id} — the endpoint Session A
// added for editing price + author + screenshots + highlights + tags + …
// in a single round-trip. Mirrors the Pydantic schema
// AdminThemeMetadataPatch on the backend.

export interface Screenshot {
  url: string;
  alt?: string | null;
  /** "mobile" or "desktop". Defaults "desktop" on the server. */
  viewport?: string;
}

export interface Highlight {
  title: string;
  body: string;
  video_url?: string | null;
}

/**
 * Subset of marketplace_themes that the admin can write via the metadata
 * PATCH. All fields optional — only those present in the object are sent
 * to the server. `price_cents` of 0 = free theme; non-zero = N cents,
 * priced in the supplied `currency`.
 */
export interface ThemeMetadataPatch {
  name?: string;
  description?: string | null;
  short_description?: string | null;
  price_cents?: number;
  currency?: string;
  thumbnail_url?: string | null;
  demo_store_url?: string | null;
  author_name?: string | null;
  author_url?: string | null;
  screenshots?: Screenshot[];
  highlights?: Highlight[];
  feature_tags?: string[];
  category?: string | null;
  tags?: string[];
  supported_languages?: string[];
}

/**
 * Full admin-facing serialisation of a marketplace_themes row. Returned
 * by the PATCH endpoint (so the caller can refresh local state in
 * place without a follow-up GET).
 */
export interface AdminThemeMetadataResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  price_cents: number;
  currency: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  demo_store_url: string | null;
  author_name: string | null;
  author_url: string | null;
  screenshots: Screenshot[];
  highlights: Highlight[];
  feature_tags: string[];
  category: string | null;
  tags: string[];
  supported_languages: string[];
  flags: ThemeFlags;
  install_count: number;
  created_at: string;
}

/**
 * PATCH /marketplace/admin/themes/{id} — Session A backend.
 * PATCH semantics — fields absent from `patch` are preserved.
 *
 * Backend validation:
 *  - price_cents must be >= 0
 *  - currency must be one of {AED, EGP, EUR, GBP, SAR, USD}
 *  - thumbnail_url / demo_store_url go through the image-host allowlist
 * Validation failures surface as 4xx with a `detail` message; apiClient
 * throws an Error with that message.
 */
export function updateThemeMetadata(
  themeId: string,
  patch: ThemeMetadataPatch,
): Promise<AdminThemeMetadataResponse> {
  return apiClient<AdminThemeMetadataResponse>(
    `/marketplace/admin/themes/${themeId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

/**
 * GET /marketplace/admin/themes/{id} — Session C backend.
 *
 * Returns the same full admin-facing dict shape as the PATCH response,
 * so the metadata form can populate without a no-op PATCH round-trip.
 * Differs from the public catalog detail endpoint by NOT requiring
 * status=published — admins need to edit drafts.
 *
 * 404 if the theme_id doesn't exist.
 */
export function getAdminTheme(
  themeId: string,
): Promise<AdminThemeMetadataResponse> {
  return apiClient<AdminThemeMetadataResponse>(
    `/marketplace/admin/themes/${themeId}`,
  );
}
