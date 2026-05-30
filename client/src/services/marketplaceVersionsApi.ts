/**
 * Marketplace versions admin service — Session C (2026-05-28).
 *
 * Wraps GET /api/v1/marketplace/admin/themes/{theme_id}/versions added in
 * Session C. Admin-side mirror of the developer's
 * /marketplace/developer/themes/{theme_id}/versions — same payload,
 * skips the developer-ownership gate.
 *
 * Read-only for this session. "Pin to default" (file 05 §3.5) is
 * deferred — the UI shows the column as "Coming soon" until a
 * follow-up session ships the corresponding mutation endpoint.
 */

import { apiClient } from "./api";

export interface AdminMarketplaceVersion {
  id: string;
  version_string: string;
  status: string;
  release_notes: string | null;
  bundle_url: string | null;
  css_url: string | null;
  checksum: string | null;
  size_bytes: number | null;
  created_at: string | null;
}

/**
 * List every version row for a marketplace theme, newest first.
 *
 * Backend gates this behind require_admin; non-super-admin sessions get
 * 401 via the apiClient's standard refresh+retry path.
 */
export function listAdminThemeVersions(
  themeId: string,
): Promise<AdminMarketplaceVersion[]> {
  return apiClient<AdminMarketplaceVersion[]>(
    `/marketplace/admin/themes/${themeId}/versions`,
  );
}
