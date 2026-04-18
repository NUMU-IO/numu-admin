/**
 * Admin API service — all admin-specific endpoint calls.
 * Maps the former tRPC procedures to direct NUMU-api calls.
 */

import { apiClient } from "./api";

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalRevenue: number;
  activeMerchants: number;
  totalOrders: number;
  totalCustomers: number;
  revenueChange: number;
  merchantsChange: number;
  ordersChange: number;
  customersChange: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiClient<DashboardStats>("/admin/dashboard/stats");
}

// ─── Merchants (Stores) ────────────────────────────────────────────────────

export interface Merchant {
  id: string;
  merchantId: string;
  name: string;
  email: string;
  domain: string | null;
  logoUrl: string | null;
  plan: string;
  status: "active" | "pending_approval" | "suspended" | "inactive";
  totalRevenue: number | null;
  totalOrders: number | null;
  createdAt: string;
}

export interface MerchantListResult {
  merchants: Merchant[];
  total: number;
}

export interface MerchantStats {
  total: number;
  active: number;
  pending_approval: number;
  suspended: number;
  inactive: number;
}

interface RawStore {
  id: string;
  name: string;
  owner_email?: string;
  subdomain?: string;
  slug?: string;
  logo_url?: string | null;
  plan?: string;
  status: string;
  total_revenue?: number;
  total_orders?: number;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function mapStore(store: RawStore): Merchant {
  return {
    id: store.id,
    merchantId: store.id,
    name: store.name,
    email: store.owner_email || `contact@${store.subdomain || store.slug || "unknown"}.com`,
    domain: store.subdomain ? `${store.subdomain}.numueg.app` : null,
    logoUrl: store.logo_url ?? null,
    plan: store.plan || "free",
    status: store.status as Merchant["status"],
    totalRevenue: store.total_revenue ?? 0,
    totalOrders: store.total_orders ?? 0,
    createdAt: store.created_at,
  };
}

export async function getMerchants(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<MerchantListResult> {
  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  if (params.limit) qs.set("page_size", String(params.limit));
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);

  const result = await apiClient<PaginatedResponse<RawStore>>(
    `/admin/stores?${qs.toString()}`
  );

  return {
    merchants: result.items.map(mapStore),
    total: result.total,
  };
}

export async function getMerchantStats(): Promise<MerchantStats> {
  return apiClient<MerchantStats>("/admin/stores/stats");
}

export async function updateMerchantStatus(
  merchantId: string,
  status: string,
  reason?: string
): Promise<void> {
  await apiClient(`/admin/stores/${merchantId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  orderId: string;
  merchantId: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  tax: number | null;
  shipping: number | null;
  discount: number | null;
  total: number;
  currency: string | null;
  items: unknown;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResult {
  orders: Order[];
  total: number;
}

export interface OrderStats {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

interface RawOrder {
  id: string;
  tenant_id?: string;
  store_id?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer?: { first_name: string; last_name: string; email: string } | null;
  status: string;
  payment_status: string;
  subtotal?: number;
  tax_amount?: number;
  shipping_cost?: number;
  discount_amount?: number;
  total: number;
  currency?: string;
  line_items?: unknown;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

function mapOrder(order: RawOrder): Order {
  return {
    id: order.id,
    orderId: order.id,
    merchantId: order.tenant_id || order.store_id || "",
    customerId: order.customer_id ?? null,
    customerName:
      order.customer_name ??
      (order.customer
        ? `${order.customer.first_name} ${order.customer.last_name}`
        : null),
    customerEmail: order.customer_email ?? order.customer?.email ?? null,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotal: order.subtotal ?? 0,
    tax: order.tax_amount ?? 0,
    shipping: order.shipping_cost ?? 0,
    discount: order.discount_amount ?? 0,
    total: order.total,
    currency: order.currency ?? null,
    items: order.line_items ?? null,
    notes: order.notes ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function getOrders(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<OrderListResult> {
  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  if (params.limit) qs.set("page_size", String(params.limit));
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);

  const result = await apiClient<PaginatedResponse<RawOrder>>(
    `/admin/orders?${qs.toString()}`
  );

  return {
    orders: result.items.map(mapOrder),
    total: result.total,
  };
}

export async function getOrderStats(): Promise<OrderStats> {
  // Fetch counts for each status in parallel
  const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
  const [allResult, ...statusResults] = await Promise.all([
    apiClient<PaginatedResponse<RawOrder>>("/admin/orders?page=1&page_size=1"),
    ...statuses.map((s) =>
      apiClient<PaginatedResponse<RawOrder>>(`/admin/orders?status=${s}&page=1&page_size=1`)
    ),
  ]);

  const counts: Record<string, number> = {};
  statuses.forEach((s, i) => {
    counts[s] = statusResults[i].total;
  });

  return {
    total: allResult.total,
    pending: counts.pending || 0,
    processing: counts.processing || 0,
    shipped: counts.shipped || 0,
    delivered: counts.delivered || 0,
    cancelled: counts.cancelled || 0,
  };
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<void> {
  await apiClient(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Customers ──────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  customerId: string;
  merchantId: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: string;
  totalOrders: number | null;
  totalSpent: number | null;
  createdAt: string;
}

export interface CustomerListResult {
  customers: Customer[];
  total: number;
}

export interface CustomerStats {
  total: number;
  active: number;
}

interface RawCustomer {
  id: string;
  tenant_id?: string;
  store_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  total_orders?: number;
  total_spent?: number;
  tags?: unknown;
  created_at: string;
  updated_at: string;
}

function mapCustomer(c: RawCustomer): Customer {
  return {
    id: c.id,
    customerId: c.id,
    merchantId: c.tenant_id || c.store_id || "",
    name: `${c.first_name} ${c.last_name}`,
    email: c.email,
    phone: c.phone ?? null,
    status: "active",
    totalOrders: c.total_orders ?? null,
    totalSpent: c.total_spent ?? null,
    createdAt: c.created_at,
  };
}

export async function getCustomers(params: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<CustomerListResult> {
  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  if (params.limit) qs.set("page_size", String(params.limit));
  if (params.search) qs.set("search", params.search);

  const result = await apiClient<PaginatedResponse<RawCustomer>>(
    `/admin/customers?${qs.toString()}`
  );

  return {
    customers: result.items.map(mapCustomer),
    total: result.total,
  };
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const result = await apiClient<PaginatedResponse<RawCustomer>>(
    "/admin/customers?page=1&page_size=1"
  );
  return { total: result.total, active: result.total };
}

// ─── Landing Page Config ────────────────────────────────────────────────────

export interface LandingConfig {
  sections: Record<string, { visible: boolean; order: number }>;
}

export async function getLandingConfig(): Promise<LandingConfig> {
  return apiClient<LandingConfig>("/admin/landing-config/");
}

export async function updateLandingConfig(
  config: LandingConfig
): Promise<LandingConfig> {
  return apiClient<LandingConfig>("/admin/landing-config/", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export type ReconciliationRunStatus = "running" | "completed" | "failed";

export type MismatchType =
  | "amount_mismatch"
  | "missing_transaction"
  | "missing_order"
  | "duplicate_transaction";

export interface AdminReconciliationRun {
  id: string;
  gateway: string;
  period_start: string;
  period_end: string;
  status: ReconciliationRunStatus;
  total_orders_checked: number;
  total_transactions_checked: number;
  mismatches_found: number;
  expected_amount_cents: number;
  actual_amount_cents: number;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AdminReconciliationMismatch {
  id: string;
  run_id: string;
  mismatch_type: MismatchType | string;
  order_id: string | null;
  order_number: string | null;
  transaction_id: string | null;
  gateway_transaction_id: string | null;
  expected_amount_cents: number | null;
  actual_amount_cents: number | null;
  gateway: string | null;
  notes: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface TriggerReconciliationResult {
  run_id: string;
  status: string;
  message: string;
}

export async function adminListReconciliationRuns(params?: {
  skip?: number;
  limit?: number;
  status?: ReconciliationRunStatus;
}): Promise<AdminReconciliationRun[]> {
  const qs = new URLSearchParams();
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<AdminReconciliationRun[]>(`/admin/reconciliation/runs${query}`);
}

export async function adminListRunMismatches(
  runId: string,
  params?: {
    mismatch_type?: string;
    resolved?: boolean;
    skip?: number;
    limit?: number;
  }
): Promise<AdminReconciliationMismatch[]> {
  const qs = new URLSearchParams();
  if (params?.mismatch_type) qs.set("mismatch_type", params.mismatch_type);
  if (params?.resolved !== undefined) qs.set("resolved", String(params.resolved));
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<AdminReconciliationMismatch[]>(
    `/admin/reconciliation/runs/${runId}/mismatches${query}`
  );
}

export async function adminTriggerReconciliation(
  targetDate: string // "YYYY-MM-DD"
): Promise<TriggerReconciliationResult> {
  return apiClient<TriggerReconciliationResult>("/admin/reconciliation/runs/trigger", {
    method: "POST",
    body: JSON.stringify({ target_date: targetDate }),
  });
}

// ─── Beta Program / Waitlist ─────────────────────────────────────────────────

export interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  phone: string | null;
  status: "pending" | "invited" | "converted";
  priority_score: number;
  referral_code: string | null;
  referral_count: number;
  invite_code: string | null;
  invited_at: string | null;
  converted_at: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistListResult {
  items: WaitlistEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getWaitlist(params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<WaitlistListResult> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  if (params?.status) qs.set("status", params.status);
  return apiClient<WaitlistListResult>(`/admin/waitlist/?${qs.toString()}`);
}

export async function directInvite(data: {
  email: string;
  name?: string;
  company_name?: string;
  notes?: string;
}): Promise<WaitlistEntry> {
  return apiClient<WaitlistEntry>("/admin/waitlist/direct-invite", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function inviteWaitlistEntry(entryId: string): Promise<WaitlistEntry> {
  return apiClient<WaitlistEntry>("/admin/waitlist/invite", {
    method: "POST",
    body: JSON.stringify({ entry_id: entryId }),
  });
}

export async function updateWaitlistPriority(
  entryId: string,
  priorityScore: number,
  notes?: string,
): Promise<WaitlistEntry> {
  return apiClient<WaitlistEntry>(`/admin/waitlist/${entryId}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority_score: priorityScore, notes }),
  });
}
