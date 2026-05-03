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
