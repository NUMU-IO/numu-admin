/**
 * Merchant (Store) API service — admin endpoints.
 */

import { apiClient } from "@/lib/apiClient";

export interface Merchant {
  id: number;
  merchantId: string;
  tenantId: string | null;
  name: string;
  email: string;
  domain: string | null;
  logoUrl: string | null;
  plan: string;
  lifecycleState: string | null;
  isInternal: boolean;
  status: "active" | "pending_approval" | "suspended" | "inactive";
  totalRevenue: number | null;
  totalOrders: number | null;
  createdAt: Date;
}

interface ApiStoreItem {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  subdomain: string | null;
  custom_domain: string | null;
  status: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan: string | null;
  lifecycle_state: string | null;
  is_internal: boolean;
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
    tenantId: store.tenant_id,
    name: store.name,
    email: store.owner_email || `contact@${store.subdomain || store.slug}.com`,
    domain: store.subdomain ? `${store.subdomain}.numueg.app` : null,
    logoUrl: store.logo_url,
    plan: store.plan || "free",
    lifecycleState: store.lifecycle_state,
    isInternal: store.is_internal ?? false,
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

// ─── InstaPay OCR provider routing (Phase C) ─────────────────────────

/** Permitted values for ``ocr_provider`` on the admin endpoint.
 *  Mirrors the backend's ``_VALID_OCR_PROVIDERS`` set. ``"none"`` is
 *  the wire value for "disable OCR for this store". */
export type InstapayOcrProvider =
  | "none"
  | "google_vision"
  | "deepseek_hf"
  | "glm_hf";

export interface AdminOcrProviderResponse {
  store_id: string;
  /** Null when set to ``"none"``; otherwise the resolved provider key. */
  provider: string | null;
}

export async function toggleMerchantInternal(
  merchantId: string,
  isInternal: boolean,
): Promise<{ store_id: string; tenant_id: string; is_internal: boolean }> {
  return apiClient(`/admin/stores/${merchantId}/internal`, {
    method: "PATCH",
    body: JSON.stringify({ is_internal: isInternal }),
  });
}

export async function setInstapayOcrProvider(
  merchantId: string,
  provider: InstapayOcrProvider,
): Promise<AdminOcrProviderResponse> {
  return apiClient<AdminOcrProviderResponse>(
    `/admin/stores/${merchantId}/instapay/ocr-provider`,
    {
      method: "PUT",
      body: JSON.stringify({ provider }),
    },
  );
}

// ─── Merchant detail (GET /admin/stores/{id}/detail) ────────────────────────

export interface MerchantDetail {
  store: {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    custom_domain: string | null;
    status: string;
    logo_url: string | null;
    country: string | null;
    default_currency: string | null;
    default_language: string | null;
    storefront_url: string | null;
    created_at: string | null;
  };
  tenant: {
    id: string;
    name: string;
    plan: string;
    lifecycle_state: string | null;
    expires_at: string | null;
    trial_started_at: string | null;
    trial_converted_at: string | null;
    billing_cycle: string | null;
    next_renewal_at: string | null;
    payment_method_last4: string | null;
    feature_flags: Record<string, boolean>;
    is_demo: boolean;
    demo_name: string | null;
    demo_email: string | null;
    demo_whatsapp: string | null;
    demo_started_at: string | null;
  } | null;
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string | null;
    plan_intent: string | null;
    trial_ends_at: string | null;
    last_login_at: string | null;
    created_at: string | null;
  } | null;
  wallet: {
    balance_cents: number;
    pending_balance_cents: number;
    currency: string;
    status: string;
    commission_bps_override: number | null;
  } | null;
  metrics: {
    orders_count: number;
    paid_revenue_cents: number;
    last_order_at: string | null;
    products_count: number;
    customers_count: number;
  };
  recent_orders: {
    id: string;
    order_number: string;
    total_cents: number;
    currency: string;
    status: string | null;
    payment_status: string | null;
    created_at: string | null;
  }[];
}

export async function getMerchantDetail(
  storeId: string,
): Promise<MerchantDetail> {
  return apiClient<MerchantDetail>(`/admin/stores/${storeId}/detail`);
}
