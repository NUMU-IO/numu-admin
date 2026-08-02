/**
 * Plan limits / features admin service.
 *
 * Wraps `/admin/plan-limits` — the REAL plan catalog (limits, feature
 * flags, prices in piasters) that gates merchants platform-wide and
 * prices InstaPay subscription payments. Changes are hot-patched
 * server-side and take effect immediately.
 *
 * NOT the same thing as /admin/landing-config/pricing-plans (landing
 * page display cards) — keep the two consistent manually.
 */

import { apiClient } from "./api";

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
  // Pricing (piasters; 0 = free, -1 = custom contract)
  monthly_price_piasters: number;
  annual_price_piasters: number;
}

export interface PlanLimitsResponse {
  plans: PlanLimitsItem[];
}

export function getPlanLimits(): Promise<PlanLimitsResponse> {
  return apiClient<PlanLimitsResponse>("/admin/plan-limits");
}

export function updatePlanLimits(
  plans: PlanLimitsItem[],
): Promise<PlanLimitsResponse> {
  return apiClient<PlanLimitsResponse>("/admin/plan-limits", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plans }),
  });
}
