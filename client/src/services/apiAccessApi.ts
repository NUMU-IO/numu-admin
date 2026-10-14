/**
 * Public-API access for one merchant.
 *
 * The plan decides by default (Pro and Enterprise include it). An admin can
 * override that either way: "on" grants the API to a merchant whose plan
 * excludes it, "off" blocks it for one whose plan includes it. The override
 * lands in the audit log as what it is.
 *
 * Changes apply on the merchant's next request. Webhook deliveries are a
 * separate entitlement (`webhooks_access`) and are not affected by this.
 */

import { apiClient } from "./api";

export type ApiAccessMode = "plan" | "on" | "off";

export interface ApiAccessState {
  tenant_id: string;
  /** "on"/"off" when an admin override exists, otherwise "plan". */
  mode: ApiAccessMode;
  granted: boolean;
  blocked: boolean;
  /** True when the tenant's plan includes the API. */
  in_plan: boolean;
  /** The effective answer — what the API actually enforces. */
  allowed: boolean;
  plan: string;
  /** False when the merchant is suspended; the API is off regardless. */
  active: boolean;
}

export function getTenantApiAccess(tenantId: string): Promise<ApiAccessState> {
  return apiClient<ApiAccessState>(`/admin/tenants/${tenantId}/api-access`);
}

/** PATCH …/{tenant_id}/api-access — set the override, and return the result. */
export function setTenantApiAccess(
  tenantId: string,
  mode: ApiAccessMode,
  note?: string,
): Promise<ApiAccessState> {
  return apiClient<ApiAccessState>(`/admin/tenants/${tenantId}/api-access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, note }),
  });
}
