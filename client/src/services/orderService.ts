/**
 * Order API service — admin endpoints.
 */

import { apiClient } from "@/lib/apiClient";

export interface Order {
  id: number;
  orderId: string;
  merchantId: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  paymentStatus: string;
  total: number;
  currency: string | null;
  items: unknown;
  createdAt: Date;
}

interface ApiOrderItem {
  id: string;
  tenant_id?: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  line_items?: unknown[];
  customer_name?: string | null;
  customer_email?: string | null;
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
    merchantId: order.tenant_id || order.store_id,
    customerId: order.customer_id,
    customerName: order.customer_name ?? null,
    customerEmail: order.customer_email ?? null,
    status: order.status as Order["status"],
    paymentStatus: order.payment_status,
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

  const result = await apiClient<PaginatedResponse<ApiOrderItem>>(
    `/admin/orders/?${searchParams}`,
  );

  const orders = result.items.map(mapOrder);
  return { orders, total: result.total };
}

export async function getOrderStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}> {
  // Fetch counts by making parallel requests for each status
  const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

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
    processing: counts.processing || 0,
    shipped: counts.shipped || 0,
    delivered: counts.delivered || 0,
    cancelled: counts.cancelled || 0,
  };
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<void> {
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
