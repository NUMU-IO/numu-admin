/**
 * Order API service — admin endpoints.
 */

import { apiClient } from "@/lib/apiClient";

export interface Order {
  id: number;
  orderId: string;
  orderNumber: string;
  merchantId: string;
  storeName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** The real lifecycle value: pending, confirmed, pending_deposit, returned… */
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  total: number;
  currency: string | null;
  items: unknown;
  createdAt: Date;
}

interface ApiOrderItem {
  id: string;
  tenant_id?: string;
  store_id: string;
  store_name?: string | null;
  customer_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  total: number;
  currency: string;
  line_items?: unknown[];
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  item_count?: number;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function mapOrder(order: ApiOrderItem, index: number): Order {
  return {
    id: index + 1,
    orderId: order.id,
    orderNumber: order.order_number,
    merchantId: order.store_id,
    storeName: order.store_name ?? null,
    customerId: order.customer_id,
    customerName: order.customer_name ?? null,
    customerEmail: order.customer_email ?? null,
    customerPhone: order.customer_phone ?? null,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method ?? null,
    total: order.total,
    currency: order.currency,
    items: order.line_items ?? null,
    createdAt: new Date(order.created_at),
  };
}

export async function getOrders(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<{ orders: Order[]; total: number }> {
  const limit = params.limit || 20;
  const page = Math.floor((params.offset || 0) / limit) + 1;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const result = await apiClient<PaginatedResponse<ApiOrderItem>>(`/admin/orders/?${searchParams}`);

  const orders = result.items.map(mapOrder);
  return { orders, total: result.total };
}

export async function getOrderStats(): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}> {
  // Fetch counts by making parallel requests for each status
  const statuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ] as const;

  const [allResult, ...statusResults] = await Promise.all([
    apiClient<PaginatedResponse<ApiOrderItem>>("/admin/orders/?page=1&limit=1"),
    ...statuses.map((s) =>
      apiClient<PaginatedResponse<ApiOrderItem>>(`/admin/orders/?status=${s}&page=1&limit=1`),
    ),
  ]);

  const counts: Record<string, number> = {};
  statuses.forEach((s, i) => {
    counts[s] = statusResults[i].total;
  });

  return {
    total: allResult.total,
    pending: counts.pending || 0,
    confirmed: counts.confirmed || 0,
    processing: counts.processing || 0,
    shipped: counts.shipped || 0,
    delivered: counts.delivered || 0,
    cancelled: counts.cancelled || 0,
  };
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  await apiClient(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteOrder(orderId: string): Promise<void> {
  await apiClient(`/admin/orders/${orderId}`, {
    method: "DELETE",
  });
}

export interface OrderLineItem {
  product_name?: string;
  name?: string;
  variant_name?: string | null;
  sku?: string | null;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
}

export interface CustomerHistoryOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  created_at: string;
}

export interface OrderDetail {
  id: string;
  store_id: string;
  store_name: string | null;
  tenant_id: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  line_items: OrderLineItem[];
  shipping_address: Record<string, string | null>;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  payment_method: string | null;
  shipping_method: string | null;
  tracking_number: string | null;
  notes: string | null;
  customer_notes: string | null;
  extra_data: {
    status_history?: {
      from: string;
      to: string;
      reason?: string | null;
      timestamp: string;
    }[];
    cancellation_reason?: string;
  } | null;
  cancelled_at: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  risk_score: number | null;
  risk_level: string | null;
  customer_history: {
    orders: number;
    delivered: number;
    cancelled: number;
    returned: number;
    paid_total: number;
    first_order_at: string | null;
    recent: CustomerHistoryOrder[];
  } | null;
}

export function getOrder(orderId: string): Promise<OrderDetail> {
  return apiClient<OrderDetail>(`/admin/orders/${orderId}`);
}
