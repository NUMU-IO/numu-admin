/**
 * Theme admin config — admin-only GET/PATCH on /admin/themes.
 *
 * Drives the Themes admin page where platform admins toggle visibility,
 * set required-plan tier, and reorder the merchant-facing theme list.
 */

import { apiClient } from "@/lib/apiClient";

export type RequiredPlan = "free" | "starter" | "pro" | "enterprise";

export interface ThemeAdminConfigItem {
  theme_slug: string;
  name: string;
  name_ar: string;
  description: string;
  is_visible: boolean;
  required_plan: RequiredPlan;
  display_order: number;
  /** Override URL for the merchant-facing preview screenshot. ``null`` means
   *  no override — the storefront uses the convention asset URL. */
  preview_image_url: string | null;
}

export type ThemeAdminConfigPatch = Partial<
  Pick<ThemeAdminConfigItem, "is_visible" | "required_plan" | "display_order">
> & { theme_slug: string };

export async function listThemeAdminConfig(): Promise<ThemeAdminConfigItem[]> {
  return apiClient<ThemeAdminConfigItem[]>("/admin/themes");
}

export async function batchUpdateThemeAdminConfig(
  themes: ThemeAdminConfigPatch[],
): Promise<ThemeAdminConfigItem[]> {
  return apiClient<ThemeAdminConfigItem[]>("/admin/themes", {
    method: "PATCH",
    body: JSON.stringify({ themes }),
  });
}

/**
 * Upload a preview screenshot for a theme. ``file`` should be a PNG, JPEG,
 * or WebP under 8MB. The backend stores it in object storage and writes
 * the resulting URL into ``preview_image_url``.
 */
export async function uploadThemePreview(
  slug: string,
  file: File,
): Promise<ThemeAdminConfigItem> {
  const form = new FormData();
  form.append("file", file);
  return apiClient<ThemeAdminConfigItem>(
    `/admin/themes/${encodeURIComponent(slug)}/preview`,
    { method: "POST", body: form },
  );
}

/**
 * Clear the preview override — the storefront falls back to the convention
 * URL ({STOREFRONT_ASSETS_BASE_URL}/themes/{slug}/preview.png).
 */
export async function clearThemePreview(
  slug: string,
): Promise<ThemeAdminConfigItem> {
  return apiClient<ThemeAdminConfigItem>(
    `/admin/themes/${encodeURIComponent(slug)}/preview`,
    { method: "DELETE" },
  );
}
