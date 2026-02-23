/**
 * NUMU Data Layer
 *
 * Provides a unified data layer that fetches all data from the NUMU backend API.
 * Handles authentication, caching, and error propagation.
 */

import { TRPCError } from "@trpc/server";
import { numuApi, NuMUProduct, NuMUCustomer, NuMUOrder } from "./numuApi";

// Cache for API availability check
let apiAvailable: boolean | null = null;
let lastApiCheck = 0;
const API_CHECK_INTERVAL = 60000; // Re-check every minute

// Cache for admin token
let adminTokenExpiry = 0;

/**
 * Check if the NUMU API is available
 */
async function isApiAvailable(): Promise<boolean> {
  const now = Date.now();

  if (apiAvailable !== null && now - lastApiCheck < API_CHECK_INTERVAL) {
    return apiAvailable;
  }

  try {
    apiAvailable = await numuApi.healthCheck();
    lastApiCheck = now;

    if (apiAvailable) {
      console.log("[NUMU Data Layer] API is available");
    } else {
      console.warn("[NUMU Data Layer] API is not available");
    }

    return apiAvailable;
  } catch {
    apiAvailable = false;
    lastApiCheck = now;
    console.warn("[NUMU Data Layer] API check failed");
    return false;
  }
}

/**
 * Ensure we have a valid admin token
 */
async function ensureAuthenticated(): Promise<boolean> {
  const now = Date.now();

  if (adminTokenExpiry > now) {
    return true;
  }

  const email = process.env.NUMU_ADMIN_EMAIL;
  const password = process.env.NUMU_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("[NUMU Data Layer] Admin credentials not configured");
    return false;
  }

  try {
    await numuApi.authenticate(email, password);
    adminTokenExpiry = now + 3600000;
    console.log("[NUMU Data Layer] Admin authentication successful");
    return true;
  } catch (error) {
    console.error("[NUMU Data Layer] Admin authentication failed:", error);
    return false;
  }
}

/**
 * Ensure API is available and authenticated. Throws if not.
 */
async function requireApi(): Promise<void> {
  const available = await isApiAvailable();
  if (!available) {
    throw new Error("NUMU API is not available");
  }
  const authed = await ensureAuthenticated();
  if (!authed) {
    throw new Error("NUMU API authentication failed");
  }
}

// ============================================================================
// Merchants (Stores in NUMU API)
// ============================================================================

export interface Merchant {
  id: number;
  merchantId: string;
  name: string;
  email: string;
  domain: string | null;
  logoUrl: string | null;
  plan: string;
  status: "active" | "pending_approval" | "suspended" | "inactive";
  country: string | null;
  category: string | null;
  totalRevenue: number | null;
  totalOrders: number | null;
  totalProducts: number | null;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export async function getMerchants(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<{ merchants: Merchant[]; total: number }> {
  await requireApi();

  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const result = await numuApi.listStoresAdmin({
    page,
    limit: params.limit,
    status: params.status,
    search: params.search,
  });

  const merchants: Merchant[] = result.items.map((store, index) => ({
    id: (page - 1) * (params.limit || 20) + index + 1,
    merchantId: store.id,
    name: store.name,
    email: store.owner_email || `contact@${store.subdomain || store.slug}.com`,
    domain: store.subdomain ? `${store.subdomain}.numu.io` : null,
    logoUrl: store.logo_url,
    plan: store.plan || "free",
    status: store.status as Merchant["status"],
    country: null,
    category: null,
    totalRevenue: store.total_revenue ?? 0,
    totalOrders: store.total_orders ?? 0,
    totalProducts: 0,
    settings: null,
    createdAt: new Date(store.created_at),
    updatedAt: new Date(store.created_at),
  }));

  return { merchants, total: result.total };
}

export async function getMerchantById(
  merchantId: string
): Promise<Merchant | null> {
  await requireApi();
  // Use list with a single result filtered by... we don't have a getById for admin stores
  // Just return null for now — the page doesn't use this
  return null;
}

export async function updateMerchantStatus(
  merchantId: string,
  status: string,
  reason?: string
): Promise<boolean> {
  await requireApi();
  await numuApi.updateStoreStatus(merchantId, status, reason);
  return true;
}

export async function getMerchantStats(): Promise<{
  total: number;
  active: number;
  pending_approval: number;
  suspended: number;
  inactive: number;
}> {
  await requireApi();
  return numuApi.getStoreStats();
}

// ============================================================================
// Orders
// ============================================================================

export interface Order {
  id: number;
  orderId: string;
  merchantId: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  paymentStatus: string;
  subtotal: number;
  tax: number | null;
  shipping: number | null;
  discount: number | null;
  total: number;
  currency: string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
  items: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapNuMUOrder(order: NuMUOrder, index: number): Order {
  return {
    id: index + 1,
    orderId: order.id,
    merchantId: order.tenant_id || order.store_id,
    customerId: order.customer_id,
    customerName:
      order.customer_name ??
      (order.customer
        ? `${order.customer.first_name} ${order.customer.last_name}`
        : null),
    customerEmail: order.customer_email ?? order.customer?.email ?? null,
    status: order.status as Order["status"],
    paymentStatus: order.payment_status,
    subtotal: order.subtotal ?? 0,
    tax: order.tax_amount ?? 0,
    shipping: order.shipping_cost ?? 0,
    discount: order.discount_amount ?? 0,
    total: order.total,
    currency: order.currency,
    shippingAddress: order.shipping_address ?? null,
    billingAddress: order.billing_address ?? null,
    items: order.line_items ?? null,
    notes: order.notes ?? null,
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
  };
}

export async function getOrders(params: {
  limit?: number;
  offset?: number;
  status?: string;
  merchantId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ orders: Order[]; total: number }> {
  await requireApi();

  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const result = await numuApi.listOrders({
    page,
    limit: params.limit,
    status: params.status,
    search: params.search,
  });

  return {
    orders: result.items.map(mapNuMUOrder),
    total: result.total,
  };
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  await requireApi();
  const order = await numuApi.getOrder(orderId);
  return mapNuMUOrder(order, 0);
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<boolean> {
  await requireApi();
  await numuApi.updateOrderStatus(orderId, status);
  return true;
}

export async function getOrderStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}> {
  await requireApi();

  const statuses = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ] as const;
  const counts: Record<string, number> = {};

  const allResult = await numuApi.listOrders({ page: 1, limit: 1 });
  const total = allResult.total;

  for (const s of statuses) {
    const result = await numuApi.listOrders({ status: s, page: 1, limit: 1 });
    counts[s] = result.total;
  }

  return {
    total,
    pending: counts.pending || 0,
    processing: counts.processing || 0,
    shipped: counts.shipped || 0,
    delivered: counts.delivered || 0,
    cancelled: counts.cancelled || 0,
  };
}

// ============================================================================
// Customers
// ============================================================================

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
  defaultAddress: unknown;
  tags: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function mapNuMUCustomer(customer: NuMUCustomer, index: number): Customer {
  return {
    id: index + 1,
    customerId: customer.id,
    merchantId: customer.tenant_id || customer.store_id,
    name: `${customer.first_name} ${customer.last_name}`,
    email: customer.email,
    phone: customer.phone,
    status: "active",
    totalOrders: customer.total_orders,
    totalSpent: customer.total_spent,
    defaultAddress: null,
    tags: customer.tags,
    createdAt: new Date(customer.created_at),
    updatedAt: new Date(customer.updated_at),
  };
}

export async function getCustomers(params: {
  limit?: number;
  offset?: number;
  merchantId?: string;
  search?: string;
}): Promise<{ customers: Customer[]; total: number }> {
  await requireApi();

  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const result = await numuApi.listCustomers({
    page,
    limit: params.limit,
    search: params.search,
  });

  return {
    customers: result.items.map(mapNuMUCustomer),
    total: result.total,
  };
}

export async function getCustomerStats(): Promise<{
  total: number;
  active: number;
}> {
  await requireApi();
  const result = await numuApi.listCustomers({ page: 1, limit: 1 });
  return { total: result.total, active: result.total };
}

// ============================================================================
// Products
// ============================================================================

export interface Product {
  id: number;
  productId: string;
  merchantId: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  costPerItem: number | null;
  currency: string | null;
  status: "active" | "draft" | "archived";
  inventory: number | null;
  category: string | null;
  images: unknown;
  variants: unknown;
  tags: unknown;
  totalSales: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapNuMUProduct(product: NuMUProduct, index: number): Product {
  return {
    id: index + 1,
    productId: product.id,
    merchantId: product.tenant_id || product.store_id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price_amount,
    compareAtPrice: product.compare_at_price,
    costPerItem: product.cost_price,
    currency: product.price_currency,
    status: product.status as Product["status"],
    inventory: product.quantity,
    category: null,
    images: product.images,
    variants: null,
    tags: product.tags,
    totalSales: 0,
    createdAt: new Date(product.created_at),
    updatedAt: new Date(product.updated_at),
  };
}

export async function getProducts(params: {
  limit?: number;
  offset?: number;
  merchantId?: string;
  status?: string;
  search?: string;
}): Promise<{ products: Product[]; total: number }> {
  await requireApi();

  const page = Math.floor((params.offset || 0) / (params.limit || 20)) + 1;
  const result = await numuApi.listProducts({
    page,
    limit: params.limit,
    status: params.status,
    search: params.search,
  });

  return {
    products: result.items.map(mapNuMUProduct),
    total: result.total,
  };
}

// ============================================================================
// Dashboard Stats
// ============================================================================

export async function getDashboardStats(): Promise<{
  totalRevenue: number;
  activeMerchants: number;
  totalOrders: number;
  totalCustomers: number;
  revenueChange: number;
  merchantsChange: number;
  ordersChange: number;
  customersChange: number;
}> {
  await requireApi();
  return numuApi.getDashboardStats();
}

// ============================================================================
// Dashboard helpers (computed from API data)
// ============================================================================

export async function getRevenueByMonth(
  _months: number = 12
): Promise<{ month: string; revenue: number }[]> {
  // Not available from the API yet
  return [];
}

export async function getTopMerchants(
  _limit: number = 5
): Promise<{ name: string; revenue: number }[]> {
  // Not available from the API yet
  return [];
}

export async function getRecentOrders(limit: number = 10): Promise<Order[]> {
  await requireApi();
  const result = await numuApi.listOrders({ page: 1, limit });
  return result.items.map(mapNuMUOrder);
}

// ============================================================================
// Landing Page Config
// ============================================================================

/**
 * Get landing page configuration
 */
export async function getLandingConfig() {
  if (!(await isApiAvailable()) || !(await ensureAuthenticated())) {
    // Return default config when API unavailable
    return {
      sections: {
        hero: { visible: true, order: 0 },
        preview: { visible: true, order: 1 },
        features: { visible: true, order: 2 },
        "import-showcase": { visible: true, order: 3 },
        "ai-showcase": { visible: true, order: 4 },
        "multichannel-showcase": { visible: true, order: 5 },
        integrations: { visible: true, order: 6 },
        testimonials: { visible: true, order: 7 },
        cta: { visible: true, order: 8 },
        footer: { visible: true, order: 9 },
      },
    };
  }

  try {
    const data = await numuApi.getLandingConfig();
    return data;
  } catch (err: any) {
    // Log detailed error for debugging
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail || err?.message;
    console.error(`[Data Layer] Failed to get landing config (status=${status}):`, detail);
    // Fall back to defaults — never block admin UI for a read-only config fetch
    return {
      sections: {
        hero: { visible: true, order: 0 },
        preview: { visible: true, order: 1 },
        features: { visible: true, order: 2 },
        "import-showcase": { visible: true, order: 3 },
        "ai-showcase": { visible: true, order: 4 },
        "multichannel-showcase": { visible: true, order: 5 },
        integrations: { visible: true, order: 6 },
        testimonials: { visible: true, order: 7 },
        cta: { visible: true, order: 8 },
        footer: { visible: true, order: 9 },
      },
    };
  }
}

/**
 * Update landing page configuration
 */
export async function updateLandingConfig(input: { sections: Record<string, { visible: boolean; order: number }> }) {
  if (!(await isApiAvailable()) || !(await ensureAuthenticated())) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "NUMU API is not available" });
  }

  try {
    const data = await numuApi.updateLandingConfig(input);
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail || err?.message;
    console.error(`[Data Layer] Failed to update landing config (status=${status}):`, detail);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to update landing page config: ${detail}` });
  }
}
