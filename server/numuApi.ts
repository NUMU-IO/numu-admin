/**
 * NUMU API Client Service
 * 
 * This service provides a typed interface to communicate with the NUMU backend API.
 * It handles authentication, request/response mapping, and error handling.
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { ENV } from "./_core/env";

// ============================================================================
// Types - Matching NUMU API Models
// ============================================================================

export interface NuMUTenant {
  id: string;
  name: string;
  subdomain: string;
  owner_id: string | null;
  plan: "free" | "starter" | "pro" | "enterprise";
  is_active: boolean;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NuMUStore {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  owner_id: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: "pending_approval" | "active" | "inactive" | "suspended";
  default_currency: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: Record<string, unknown> | null;
  social_links: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NuMUProduct {
  id: string;
  tenant_id: string;
  store_id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  short_description: string | null;
  product_type: "physical" | "digital" | "service";
  status: "draft" | "active" | "archived";
  price_amount: number; // in cents
  price_currency: string;
  compare_at_price: number | null;
  cost_price: number | null;
  quantity: number;
  low_stock_threshold: number;
  weight: number | null;
  dimensions: Record<string, unknown> | null;
  images: string[] | null;
  category_id: string | null;
  tags: string[] | null;
  attributes: Record<string, unknown> | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NuMUCustomer {
  id: string;
  tenant_id: string;
  store_id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  accepts_marketing: boolean;
  notes: string | null;
  tags: string[] | null;
  default_address_id: string | null;
  total_orders: number;
  total_spent: number; // in cents
  extra_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NuMUOrder {
  id: string;
  tenant_id?: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  fulfillment_status: "unfulfilled" | "partially_fulfilled" | "fulfilled";
  line_items?: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  shipping_address?: Record<string, unknown>;
  billing_address?: Record<string, unknown> | null;
  subtotal?: number; // in cents
  shipping_cost?: number;
  tax_amount?: number;
  discount_amount?: number;
  total: number;
  currency: string;
  payment_method: string | null;
  payment_id?: string | null;
  shipping_method?: string | null;
  tracking_number?: string | null;
  notes?: string | null;
  customer_notes?: string | null;
  extra_data?: Record<string, unknown> | null;
  cancelled_at?: string | null;
  paid_at?: string | null;
  fulfilled_at?: string | null;
  created_at: string;
  updated_at: string;
  // Flat fields from admin list endpoint
  customer_name?: string | null;
  customer_email?: string | null;
  store_name?: string | null;
  item_count?: number;
  // Joined data (from detail endpoint)
  customer?: NuMUCustomer;
  store?: NuMUStore;
}

export interface NuMUUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "user" | "store_owner" | "admin" | "super_admin";
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
}

// API Response Types (field names match NUMU-api PaginatedListResponse)
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface SuccessResponse<T> {
  data: T;
  message: string;
}

// ============================================================================
// NUMU API Client
// ============================================================================

class NuMUApiClient {
  private client: AxiosInstance;
  private adminToken: string | null = null;

  constructor() {
    // Get the NUMU API URL from environment
    const baseURL = process.env.NUMU_API_URL || "http://localhost:8000";
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      if (this.adminToken) {
        config.headers.Authorization = `Bearer ${this.adminToken}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error("[NUMU API Error]", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Set the admin authentication token
   */
  setAdminToken(token: string) {
    this.adminToken = token;
  }

  /**
   * Authenticate as admin and get JWT token
   */
  async authenticate(email: string, password: string): Promise<string> {
    const response = await this.client.post<SuccessResponse<{ tokens: { access_token: string } }>>("/api/v1/auth/login", {
      email,
      password,
    });
    this.adminToken = response.data.data.tokens.access_token;
    return this.adminToken;
  }

  // ==========================================================================
  // Tenants (Merchants) API
  // ==========================================================================

  /**
   * List all tenants (admin only)
   */
  async listTenants(params?: {
    skip?: number;
    limit?: number;
  }): Promise<NuMUTenant[]> {
    const response = await this.client.get<NuMUTenant[]>("/api/v1/admin/tenants", {
      params,
    });
    return response.data;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<NuMUTenant> {
    const response = await this.client.get<NuMUTenant>(`/api/v1/admin/tenants/${tenantId}`);
    return response.data;
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: {
    name?: string;
    plan?: string;
    is_active?: boolean;
    settings?: Record<string, unknown>;
  }): Promise<NuMUTenant> {
    const response = await this.client.patch<NuMUTenant>(`/api/v1/admin/tenants/${tenantId}`, data);
    return response.data;
  }

  /**
   * Deactivate tenant
   */
  async deactivateTenant(tenantId: string): Promise<void> {
    await this.client.delete(`/api/v1/admin/tenants/${tenantId}`);
  }

  // ==========================================================================
  // Stores API
  // ==========================================================================

  /**
   * List stores
   */
  async listStores(params?: {
    page?: number;
    limit?: number;
    is_active?: boolean;
  }): Promise<PaginatedResponse<NuMUStore>> {
    const response = await this.client.get<SuccessResponse<PaginatedResponse<NuMUStore>>>("/api/v1/stores", {
      params,
    });
    return response.data.data;
  }

  /**
   * Get store by ID
   */
  async getStore(storeId: string): Promise<NuMUStore> {
    const response = await this.client.get<SuccessResponse<NuMUStore>>(`/api/v1/stores/${storeId}`);
    return response.data.data;
  }

  /**
   * Update store status
   */
  async updateStore(storeId: string, data: {
    name?: string;
    description?: string;
    status?: string;
  }): Promise<NuMUStore> {
    const response = await this.client.patch<SuccessResponse<NuMUStore>>(`/api/v1/stores/${storeId}`, data);
    return response.data.data;
  }

  // ==========================================================================
  // Products API
  // ==========================================================================

  /**
   * List products (admin endpoint — all stores)
   */
  async listProducts(params?: {
    store_id?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<NuMUProduct>> {
    const response = await this.client.get<SuccessResponse<PaginatedResponse<NuMUProduct>>>("/api/v1/admin/products", {
      params,
    });
    return response.data.data;
  }

  // ==========================================================================
  // Customers API (admin endpoint)
  // ==========================================================================

  /**
   * List customers (admin — all stores)
   */
  async listCustomers(params?: {
    store_id?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<NuMUCustomer>> {
    const response = await this.client.get<SuccessResponse<PaginatedResponse<NuMUCustomer>>>("/api/v1/admin/customers", {
      params,
    });
    return response.data.data;
  }

  // ==========================================================================
  // Orders API (admin endpoint)
  // ==========================================================================

  /**
   * List orders (admin — all stores)
   */
  async listOrders(params?: {
    store_id?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<NuMUOrder>> {
    const response = await this.client.get<SuccessResponse<PaginatedResponse<NuMUOrder>>>("/api/v1/admin/orders", {
      params,
    });
    return response.data.data;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<NuMUOrder> {
    const response = await this.client.get<SuccessResponse<NuMUOrder>>(`/api/v1/admin/orders/${orderId}`);
    return response.data.data;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<NuMUOrder> {
    const response = await this.client.patch<SuccessResponse<NuMUOrder>>(`/api/v1/admin/orders/${orderId}/status`, {
      status,
    });
    return response.data.data;
  }

  // ==========================================================================
  // Admin Store Management API
  // ==========================================================================

  /**
   * List all stores (admin — with owner info, status filter, search)
   */
  async listStoresAdmin(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<{
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
  }>> {
    const response = await this.client.get<SuccessResponse<PaginatedResponse<any>>>("/api/v1/admin/stores", {
      params,
    });
    return response.data.data;
  }

  /**
   * Update store status (admin — approve, suspend, activate, deactivate)
   */
  async updateStoreStatus(storeId: string, status: string, reason?: string): Promise<{ id: string; status: string }> {
    const response = await this.client.patch<SuccessResponse<{ id: string; status: string }>>(`/api/v1/admin/stores/${storeId}/status`, {
      status,
      reason,
    });
    return response.data.data;
  }

  /**
   * Get store statistics (admin)
   */
  async getStoreStats(): Promise<{
    total: number;
    active: number;
    pending_approval: number;
    suspended: number;
    inactive: number;
  }> {
    const response = await this.client.get<SuccessResponse<{
      total: number;
      active: number;
      pending_approval: number;
      suspended: number;
      inactive: number;
    }>>("/api/v1/admin/stores/stats");
    return response.data.data;
  }

  // ==========================================================================
  // Dashboard Stats API
  // ==========================================================================

  /**
   * Get platform-wide statistics
   */
  async getDashboardStats(): Promise<{
    totalRevenue: number;
    activeMerchants: number;
    totalOrders: number;
    totalCustomers: number;
    revenueChange: number;
    merchantsChange: number;
    ordersChange: number;
    customersChange: number;
  }> {
    try {
      const response = await this.client.get<SuccessResponse<{
        total_revenue: number;
        active_merchants: number;
        total_orders: number;
        total_customers: number;
        revenue_change: number;
        merchants_change: number;
        orders_change: number;
        customers_change: number;
      }>>("/api/v1/admin/dashboard/stats");

      const d = response.data.data;
      return {
        totalRevenue: d.total_revenue,
        activeMerchants: d.active_merchants,
        totalOrders: d.total_orders,
        totalCustomers: d.total_customers,
        revenueChange: d.revenue_change,
        merchantsChange: d.merchants_change,
        ordersChange: d.orders_change,
        customersChange: d.customers_change,
      };
    } catch (error) {
      // If the endpoint doesn't exist, return zeros
      console.warn("[NUMU API] Dashboard stats endpoint not available, using fallback");
      return {
        totalRevenue: 0,
        activeMerchants: 0,
        totalOrders: 0,
        totalCustomers: 0,
        revenueChange: 0,
        merchantsChange: 0,
        ordersChange: 0,
        customersChange: 0,
      };
    }
  }

  // ==========================================================================
  // Landing Page Config API
  // ==========================================================================

  /**
   * Get landing page configuration
   */
  async getLandingConfig(): Promise<any> {
    const res = await this.client.get("/api/v1/admin/landing-config/");
    return res.data?.data;
  }

  /**
   * Update landing page configuration
   */
  async updateLandingConfig(data: { sections: Record<string, { visible: boolean; order: number }> }): Promise<any> {
    const res = await this.client.put("/api/v1/admin/landing-config/", data);
    return res.data?.data;
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check if the NUMU API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get("/api/v1/health");
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const numuApi = new NuMUApiClient();

// Export class for testing
export { NuMUApiClient };
