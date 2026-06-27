/**
 * Plan Limits API service — admin endpoints for managing plan features,
 * limits, and pricing.
 */

import { apiClient } from "@/lib/apiClient";

export interface PlanLimitsItem {
  key: string;
  display_name: string;
  // Limits (-1 = unlimited)
  max_products: number;
  max_orders_per_month: number;
  max_stores: number;
  max_staff_members: number;
  max_customers: number;
  // Feature flags
  webhooks_enabled: boolean;
  custom_domain_enabled: boolean;
  api_access_enabled: boolean;
  analytics_enabled: boolean;
  discount_codes_enabled: boolean;
  // Pricing (piasters — divide by 100 for EGP)
  monthly_price_piasters: number;
  annual_price_piasters: number;
}

export interface PlanLimitsResponse {
  plans: PlanLimitsItem[];
}

export async function getPlanLimits(): Promise<PlanLimitsResponse> {
  return apiClient<PlanLimitsResponse>("/admin/plan-limits");
}

export async function updatePlanLimits(
  plans: PlanLimitsItem[],
): Promise<PlanLimitsResponse> {
  return apiClient<PlanLimitsResponse>("/admin/plan-limits", {
    method: "PUT",
    body: JSON.stringify({ plans }),
  });
}
