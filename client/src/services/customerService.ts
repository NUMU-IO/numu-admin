/**
 * Customer API service — admin endpoints.
 */

import { apiClient } from "@/lib/apiClient";

export interface Customer {
  id: number;
  customerId: string;
  merchantId: string;
  name: string | null;
  email: string;
  phone: string | null;
  status: "active" | "inactive";
  totalOrders: number | null;
  totalSpent: number | null;
  createdAt: Date;
}

interface ApiCustomerItem {
  id: string;
  tenant_id: string;
  store_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  total_orders: number;
  total_spent: number;
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

function mapCustomer(customer: ApiCustomerItem, index: number): Customer {
  return {
    id: index + 1,
    customerId: customer.id,
    merchantId: customer.tenant_id || customer.store_id,
    name: `${customer.first_name} ${customer.last_name}`.trim() || null,
    email: customer.email,
    phone: customer.phone,
    status: "active",
    totalOrders: customer.total_orders,
    totalSpent: customer.total_spent,
    createdAt: new Date(customer.created_at),
  };
}

export async function getCustomers(params: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ customers: Customer[]; total: number }> {
  const limit = params.limit || 20;
  const page = Math.floor((params.offset || 0) / limit) + 1;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));
  if (params.search) searchParams.set("search", params.search);

  const result = await apiClient<PaginatedResponse<ApiCustomerItem>>(
    `/admin/customers/?${searchParams}`,
  );

  const customers = result.items.map(mapCustomer);
  return { customers, total: result.total };
}

export async function getCustomerStats(): Promise<{
  total: number;
  active: number;
}> {
  const result = await apiClient<PaginatedResponse<ApiCustomerItem>>(
    "/admin/customers/?page=1&limit=1",
  );
  return { total: result.total, active: result.total };
}
