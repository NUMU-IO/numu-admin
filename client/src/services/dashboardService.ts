/**
 * Dashboard API service — platform-wide statistics.
 */

import { apiClient } from "@/lib/apiClient";

export interface MRRBreakdown {
  total: number;
  starterMonthly: number;
  starterAnnual: number;
  proMonthly: number;
  proAnnual: number;
  subscriberCount: number;
}

export interface DashboardStats {
  totalRevenue: number;
  activeMerchants: number;
  totalOrders: number;
  totalCustomers: number;
  revenueChange: number;
  merchantsChange: number;
  ordersChange: number;
  customersChange: number;
  mrr: MRRBreakdown;
}

const EMPTY_MRR: MRRBreakdown = {
  total: 0,
  starterMonthly: 0,
  starterAnnual: 0,
  proMonthly: 0,
  proAnnual: 0,
  subscriberCount: 0,
};

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const data = await apiClient<{
      total_revenue: number;
      active_merchants: number;
      total_orders: number;
      total_customers: number;
      revenue_change: number;
      merchants_change: number;
      orders_change: number;
      customers_change: number;
      mrr: {
        total: number;
        starter_monthly: number;
        starter_annual: number;
        pro_monthly: number;
        pro_annual: number;
        subscriber_count: number;
      };
    }>("/admin/dashboard/stats");

    return {
      totalRevenue: data.total_revenue,
      activeMerchants: data.active_merchants,
      totalOrders: data.total_orders,
      totalCustomers: data.total_customers,
      revenueChange: data.revenue_change,
      merchantsChange: data.merchants_change,
      ordersChange: data.orders_change,
      customersChange: data.customers_change,
      mrr: {
        total: data.mrr.total,
        starterMonthly: data.mrr.starter_monthly,
        starterAnnual: data.mrr.starter_annual,
        proMonthly: data.mrr.pro_monthly,
        proAnnual: data.mrr.pro_annual,
        subscriberCount: data.mrr.subscriber_count,
      },
    };
  } catch {
    return {
      totalRevenue: 0,
      activeMerchants: 0,
      totalOrders: 0,
      totalCustomers: 0,
      revenueChange: 0,
      merchantsChange: 0,
      ordersChange: 0,
      customersChange: 0,
      mrr: EMPTY_MRR,
    };
  }
}
