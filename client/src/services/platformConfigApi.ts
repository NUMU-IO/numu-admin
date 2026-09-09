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
  /** Phase 5.2 — whether the merchant editor shows the "App embeds" tab. */
  app_embeds_tab_enabled: boolean;
  /** Phone-first checkout identity rollout gate (WhatsApp OTP at checkout
   * + save-cart nudge). Effective value: stored admin flag when set, else
   * the API's CHECKOUT_IDENTITY_ENABLED env default. */
  checkout_identity_enabled: boolean;
}

export function getPlatformConfig(): Promise<PlatformConfigSnapshot> {
  return apiClient<PlatformConfigSnapshot>("/admin/platform-config");
}

/**
 * Toggle the merchant theme editor's "App embeds" tab platform-wide.
 * Default OFF — turn on only once a first-party app-embed platform exists.
 * Flows to merchants via /auth/me feature_flags (`theme_app_embeds`).
 */
export function setAppEmbedsTabEnabled(
  enabled: boolean,
): Promise<PlatformConfigSnapshot> {
  return apiClient<PlatformConfigSnapshot>("/admin/platform-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_embeds_tab_enabled: enabled }),
  });
}

/**
 * Flip the phone-first checkout-identity rollout gate platform-wide.
 *
 * ON = every GOWA-transport store whose merchant hasn't opted out
 * (require_verification defaults true in their checkout-fields settings)
 * starts requiring a WhatsApp OTP at checkout, and the save-cart nudge
 * goes live. Meta-only stores self-degrade (otp_available=false) and are
 * unaffected. OFF = the whole feature is inert everywhere — this is also
 * the kill switch. Once set here, this value wins over the API's
 * CHECKOUT_IDENTITY_ENABLED env default.
 */
export function setCheckoutIdentityEnabled(
  enabled: boolean,
): Promise<PlatformConfigSnapshot> {
  return apiClient<PlatformConfigSnapshot>("/admin/platform-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkout_identity_enabled: enabled }),
  });
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
