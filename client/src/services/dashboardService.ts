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

export interface QueueCounts {
  whatsappAccess: number;
  marketplaceReview: number;
  riskReview: number;
  supportCases: number;
  subscriptionPayments: number;
  walletTopups: number;
  paymentFailedOrders: number;
  unfulfilledOrders: number;
  readOnlyTenants: number;
  trialingTenants: number;
  /** The four review queues only — the order and lifecycle counts are context. */
  total: number;
}

const EMPTY_QUEUES: QueueCounts = {
  whatsappAccess: 0,
  marketplaceReview: 0,
  riskReview: 0,
  supportCases: 0,
  subscriptionPayments: 0,
  walletTopups: 0,
  paymentFailedOrders: 0,
  unfulfilledOrders: 0,
  readOnlyTenants: 0,
  trialingTenants: 0,
  total: 0,
};

/**
 * Depth of every queue waiting on an operator.
 *
 * One request feeds both the sidebar badges and the overview triage strip.
 * A failure returns zeros rather than throwing: the shell must still render
 * when this endpoint is unavailable, and a missing badge is a smaller lie
 * than a crashed navigation.
 */
export async function getQueueCounts(): Promise<QueueCounts> {
  try {
    const d = await apiClient<{
      whatsapp_access: number;
      marketplace_review: number;
      risk_review: number;
      support_cases: number;
      subscription_payments: number;
      wallet_topups: number;
      payment_failed_orders: number;
      unfulfilled_orders: number;
      read_only_tenants: number;
      trialing_tenants: number;
      total: number;
    }>("/admin/dashboard/queues");

    return {
      whatsappAccess: d.whatsapp_access,
      marketplaceReview: d.marketplace_review,
      riskReview: d.risk_review,
      supportCases: d.support_cases,
      subscriptionPayments: d.subscription_payments,
      walletTopups: d.wallet_topups,
      paymentFailedOrders: d.payment_failed_orders,
      unfulfilledOrders: d.unfulfilled_orders,
      readOnlyTenants: d.read_only_tenants,
      trialingTenants: d.trialing_tenants,
      total: d.total,
    };
  } catch {
    return EMPTY_QUEUES;
  }
}

export interface AdminSearchHit {
  id: string;
  kind: "merchant" | "store" | "order" | "customer";
  label: string;
  meta: string | null;
  /** Admin URL that opens this entity. Built server-side so it stays correct. */
  href: string;
}

/** Cross-entity search behind the command palette. */
export async function adminSearch(query: string): Promise<AdminSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const d = await apiClient<{ hits: AdminSearchHit[] }>(
      `/admin/dashboard/search?q=${encodeURIComponent(q)}`,
    );
    return d.hits;
  } catch {
    return [];
  }
}

// ─── Overview screen ────────────────────────────────────────────────────────

export interface Trend {
  value: number;
  delta: number | null;
  /** "count" absolute, "pct" percentage, "pp" percentage points. */
  delta_unit: "count" | "pct" | "pp";
  spark: number[];
  note: string | null;
}

export interface OverviewBucket {
  label: string;
  value: number;
  highlight: boolean;
}

export interface AttentionOrder {
  id: string;
  order_number: string;
  store_name: string;
  store_id: string;
  tenant_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  status: string;
  payment_status: string;
  total_cents: number;
  currency: string;
  risk_score: number | null;
  risk_level: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  actor: string | null;
  actor_type: string;
  entity: string | null;
  note: string | null;
  severity: string;
  created_at: string;
}

export interface HealthSignal {
  id: string;
  severity: string;
  title: string;
  detail: string;
}

export interface Earnings {
  mrr_cents: number;
  mrr_subscribers: number;
  mrr_by_plan: Record<string, number>;
  plan_counts: Record<string, number>;
  subscriptions_collected_30d: number;
  payg_commission_30d: number;
  /** Cash the wallets took in. Not revenue until it is spent as commission. */
  wallet_topups_collected_30d: number;
  /** Merchant money currently held — a liability, not income. */
  wallet_float_cents: number;
  /** subscriptions_collected_30d + payg_commission_30d. */
  recognised_30d: number;
}

export interface AdminOverview {
  generated_at: string;
  health: HealthSignal[];
  earnings: Earnings;
  metrics: {
    active_merchants: Trend;
    active_stores: Trend;
    orders_today: Trend;
    order_value_today: Trend;
    trial_to_paid_30d: Trend;
    failed_payments_24h: Trend;
    stores_requiring_review: Trend;
    high_risk_cod_orders: Trend;
    /** Null when the platform has no source for it — render a dash, not 0. */
    open_support_cases: Trend | null;
    failed_jobs_webhooks: Trend;
  };
  orders_per_hour: OverviewBucket[];
  webhook_failures_per_hour: OverviewBucket[];
  orders_needing_attention: AttentionOrder[];
  activity: ActivityEntry[];
}

/**
 * The whole overview in one request.
 *
 * Deliberately not split per tile: every number shares one demo/internal
 * exclusion and one clock, so fetching them separately lets the tiles
 * disagree with each other mid-refresh.
 */
export function getAdminOverview(): Promise<AdminOverview> {
  return apiClient<AdminOverview>("/admin/dashboard/overview");
}
