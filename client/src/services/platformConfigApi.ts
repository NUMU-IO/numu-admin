/**
 * Platform config service — Session B (2026-05-28).
 *
 * Wraps the top-level `/admin/platform-config` endpoint that Session A
 * added for setting the platform-wide default theme. Distinct from
 * `platformSettingsApi.ts` which talks to `/admin/platform-settings` (the
 * branding + signup-gating bag).
 *
 *   GET   /admin/platform-config
 *     → { default_marketplace_theme_id: UUID | null,
 *         default_marketplace_theme: {id, slug, name, status} | null }
 *
 *   PATCH /admin/platform-config
 *     body: { default_marketplace_theme_id: UUID | null }
 *     - explicit null clears the default
 *     - omitted key preserves current value (handled by pydantic
 *       `model_fields_set` on the backend)
 *     - non-published or non-installable theme_id → 400 with a clear
 *       error message (mapped to thrown Error here)
 */

import { apiClient } from "./api";

export interface DefaultThemeSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface PlatformConfigSnapshot {
  default_marketplace_theme_id: string | null;
  default_marketplace_theme: DefaultThemeSummary | null;
}

export function getPlatformConfig(): Promise<PlatformConfigSnapshot> {
  return apiClient<PlatformConfigSnapshot>("/admin/platform-config");
}

/**
 * Set or clear the platform default theme. Pass null to clear (new
 * stores then fall through to legacy V2 — sawsaw + rabbit unaffected).
 *
 * Server validates: theme must be published + flags.installable=true.
 * Surface a thrown Error on validation failure; caller toast-handles.
 */
export function setDefaultTheme(
  themeId: string | null,
): Promise<PlatformConfigSnapshot> {
  return apiClient<PlatformConfigSnapshot>("/admin/platform-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ default_marketplace_theme_id: themeId }),
  });
}
