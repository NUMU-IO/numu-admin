/**
 * Merchant (Store) API service — admin endpoints.
 */

import { apiClient } from "@/lib/apiClient";

export interface Merchant {
  id: number;
  merchantId: string;
  name: string;
  email: string;
  domain: string | null;
  logoUrl: string | null;
  plan: string;
  status: "active" | "pending_approval" | "suspended" | "inactive";
  totalRevenue: number | null;
  totalOrders: number | null;
  createdAt: Date;
}

interface ApiStoreItem {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  custom_domain: string | null;
  status: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan: string | null;
  logo_url: string | null;
  total_revenue: number;
  total_orders: number;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function mapStore(store: ApiStoreItem, index: number, pageOffset: number): Merchant {
  return {
    id: pageOffset + index + 1,
    merchantId: store.id,
    name: store.name,
    email: store.owner_email || `contact@${store.subdomain || store.slug}.com`,
    domain: store.subdomain ? `${store.subdomain}.numueg.app` : null,
    logoUrl: store.logo_url,
    plan: store.plan || "free",
    status: store.status as Merchant["status"],
    totalRevenue: store.total_revenue ?? 0,
    totalOrders: store.total_orders ?? 0,
    createdAt: new Date(store.created_at),
  };
}

export async function getMerchants(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<{ merchants: Merchant[]; total: number }> {
  const limit = params.limit || 20;
  const page = Math.floor((params.offset || 0) / limit) + 1;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const result = await apiClient<PaginatedResponse<ApiStoreItem>>(
    `/admin/stores/?${searchParams}`,
  );

  const pageOffset = (page - 1) * limit;
  const merchants = result.items.map((s, i) => mapStore(s, i, pageOffset));

  return { merchants, total: result.total };
}

export async function getMerchantStats(): Promise<{
  total: number;
  active: number;
  pending_approval: number;
  suspended: number;
  inactive: number;
}> {
  return apiClient("/admin/stores/stats");
}

export async function updateMerchantStatus(
  merchantId: string,
  status: string,
  reason?: string,
): Promise<{ id: string; status: string }> {
  return apiClient(`/admin/stores/${merchantId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export interface ImpersonateResponse {
  dashboard_url: string;
  store_id: string;
  owner_id: string;
  owner_email: string;
  /** Backend also returns the raw tokens so the frontend can construct an
   * alternative handoff URL if needed; usually we just use dashboard_url
   * which already carries the token in its fragment. */
  access_token: string;
  refresh_token: string;
}

export async function impersonateMerchant(
  merchantId: string,
): Promise<ImpersonateResponse> {
  return apiClient<ImpersonateResponse>(
    `/admin/stores/${merchantId}/impersonate`,
    { method: "POST" },
  );
}
