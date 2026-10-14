/**
 * Merchant API tokens and what each one is doing.
 *
 * The API records every request made with a token — including the ones it
 * refuses (wrong store, missing scope, API access off) — and keeps the last
 * 1000 per token. Refusals are the signal worth watching: a token probing
 * another store's data shows up there first.
 */

import { apiClient } from "./api";

export interface ApiTokenRequest {
  at: string;
  method: string;
  path: string;
  status: number;
  ip: string;
  user_agent: string;
  ms: number;
}

export interface ApiTokenItem {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[] | null;
  tenant_id: string | null;
  tenant: string | null;
  store_id: string | null;
  store_name: string | null;
  minted_by: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  trail: {
    requests: number;
    refused: number;
    distinct_ips: number;
    last: ApiTokenRequest | null;
  };
}

/** Internal merchants' tokens are left out unless `tenantId` names one. */
export function listApiTokens(tenantId?: string): Promise<ApiTokenItem[]> {
  const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : "";
  return apiClient<ApiTokenItem[]>(`/admin/api-tokens${query}`);
}

export function revokeApiToken(tokenId: string, reason: string): Promise<ApiTokenItem> {
  return apiClient<ApiTokenItem>(`/admin/api-tokens/${tokenId}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function revokeAllApiTokens(
  tenantId: string,
  reason: string,
): Promise<{ revoked: number }> {
  return apiClient<{ revoked: number }>(`/admin/tenants/${tenantId}/api-tokens/revoke-all`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listApiTokenRequests(tokenId: string, limit = 200): Promise<ApiTokenRequest[]> {
  return apiClient<ApiTokenRequest[]>(`/admin/api-tokens/${tokenId}/requests?limit=${limit}`);
}
