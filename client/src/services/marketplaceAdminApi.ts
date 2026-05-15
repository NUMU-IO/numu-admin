/**
 * Marketplace admin API — moderation queue for BYOT theme submissions.
 *
 * Wraps the SUPER_ADMIN-only routes under `/marketplace/admin/`. The
 * backend routes already gate on the admin cookie + CSRF token, so the
 * shared apiClient picks them up automatically — no extra auth wiring
 * needed here.
 *
 * Why this lives next to themeAdminApi.ts:
 *   - themeAdminApi.ts edits the BUILT-IN theme catalog flags (visibility,
 *     plan tier, preview images).
 *   - marketplaceAdminApi.ts moderates BYOT marketplace submissions
 *     (developer-uploaded themes pending review).
 *   They use entirely different backends; merging them would be confusing.
 */

import { apiClient } from "@/lib/apiClient";

export interface PendingReviewVersionHistoryEntry {
  version_id: string;
  version_string: string;
  status: string;
  size_bytes: number | null;
  checksum: string | null;
  created_at: string | null;
  is_current: boolean;
}

export interface PendingReviewItem {
  // Identity
  version_id: string;
  version_string: string;
  theme_id: string;
  release_notes: string | null;
  size_bytes: number | null;
  checksum: string | null;
  created_at: string | null;
  bundle_url: string | null;
  css_url: string | null;
  build_log: string | null;
  // Listing
  theme_name: string | null;
  theme_slug: string | null;
  theme_description: string | null;
  theme_short_description: string | null;
  theme_category: string | null;
  theme_tags: string[];
  theme_supported_languages: string[];
  theme_supported_features: Record<string, unknown>;
  theme_status: string | null;
  price_cents: number;
  currency: string;
  // Marketing
  thumbnail_url: string | null;
  preview_url: string | null;
  demo_store_url: string | null;
  // Developer profile
  developer_id: string | null;
  developer_email: string | null;
  developer_name: string | null;
  developer_total_themes: number;
  developer_published_themes: number;
  // Schemas
  settings_schema: unknown;
  section_schemas: unknown;
  // History
  version_history: PendingReviewVersionHistoryEntry[];
}

export interface PendingReviewListResponse {
  pending: PendingReviewItem[];
}

export interface ReviewDecisionResponse {
  version_id: string;
  status: string;
}

export type ReviewDecision = "approve" | "reject";

export async function listPendingReviews(): Promise<PendingReviewItem[]> {
  const data = await apiClient<PendingReviewListResponse>(
    "/marketplace/admin/pending",
  );
  return data.pending;
}

export async function submitReviewDecision(
  versionId: string,
  decision: ReviewDecision,
  notes?: string,
): Promise<ReviewDecisionResponse> {
  return apiClient<ReviewDecisionResponse>(
    `/marketplace/admin/versions/${encodeURIComponent(versionId)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ decision, notes: notes ?? null }),
    },
  );
}
