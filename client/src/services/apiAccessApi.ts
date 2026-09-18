/**
 * Public-API access for one merchant.
 *
 * Access comes from the plan (Pro and Enterprise include it) or from a grant
 * we make here. The grant is the `api_access` tenant feature flag, which this
 * endpoint wraps so nobody has to remember which JSON key to flip — and so the
 * change lands in the audit log as what it is.
 *
 * Revoking takes effect immediately: tokens are checked on every request, and
 * webhook deliveries stop with them.
 */

import { apiClient } from "./api";

export interface ApiAccessState {
  tenant_id: string;
  /** The grant flag we control here. */
  granted: boolean;
  /** True when the tenant's plan includes the API regardless of the grant. */
  in_plan: boolean;
  /** The effective answer — what the API actually enforces. */
  allowed: boolean;
  plan: string;
}

/** PATCH …/{tenant_id}/api-access — grant or revoke, and return the result. */
export function setTenantApiAccess(
  tenantId: string,
  enabled: boolean,
  note?: string,
): Promise<ApiAccessState> {
  return apiClient<ApiAccessState>(`/admin/tenants/${tenantId}/api-access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, note }),
  });
}
