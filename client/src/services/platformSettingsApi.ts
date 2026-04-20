/**
 * Platform settings — admin-only GET/PATCH on /admin/platform-settings.
 *
 * Drives the Settings > General + Security tabs.
 */

import { apiClient } from "@/lib/apiClient";

export interface PlatformSettings {
  platform_name: string;
  support_email: string;
  default_currency: string;
  enable_new_merchant_signups: boolean;
  require_email_verification: boolean;
  enable_two_factor_auth: boolean;
  maintenance_mode: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
}

export type PlatformSettingsUpdate = Partial<PlatformSettings>;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return apiClient<PlatformSettings>("/admin/platform-settings");
}

export async function updatePlatformSettings(
  patch: PlatformSettingsUpdate,
): Promise<PlatformSettings> {
  return apiClient<PlatformSettings>("/admin/platform-settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
