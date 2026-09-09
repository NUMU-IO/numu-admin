/**
 * Merchant leads — the acquisition funnel.
 *
 * Wraps `/admin/leads`, which already exists and is unusually complete: a
 * lead outlives the tenant it created, so this is the only place a merchant
 * who churned is still visible.
 *
 * Note `plan_intent` versus `tenant_plan`: the first is the card they clicked
 * on the landing page, the second is what they are actually on. The two
 * diverging is a signal, not a bug, and the UI shows both.
 */

import { apiClient } from "@/lib/apiClient";

export type LeadStatusFilter =
  | "all"
  | "new"
  | "demo_started"
  | "registered"
  | "store_created"
  | "activated";

export interface Lead {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  source: string;
  last_source: string | null;
  status: string;
  plan_intent: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  tenant_id: string | null;
  store_subdomain: string | null;
  whatsapp_phone: string | null;
  language: string | null;
  sells_what: string | null;
  sells_where_today: string | null;
  monthly_orders_band: string | null;
  city: string | null;
  tenant_plan: string | null;
  tenant_lifecycle: string | null;
  is_registered_business: boolean | null;
  has_payout_account: boolean;
  business_complete: boolean;
  demo_started_at: string | null;
  registered_at: string | null;
  store_created_at: string | null;
  first_product_at: string | null;
  first_order_at: string | null;
  first_commission_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  has_phone: boolean;
}

export interface PaginatedLeads {
  items: Lead[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LeadFunnel {
  leads: number;
  registered: number;
  store_created: number;
  first_product: number;
  activated: number;
  paying: number;
}

export interface ChannelRow {
  channel: string;
  leads: number;
  stores_created: number;
}

export interface LeadStats {
  total: number;
  by_status: Record<string, number>;
  with_phone: number;
  channels: ChannelRow[];
  funnel: LeadFunnel;
  by_sells_what: Record<string, number>;
  by_orders_band: Record<string, number>;
  by_sells_where: Record<string, number>;
  by_plan: Record<string, number>;
  business_profiles_complete: number;
}

export function listLeads(params: {
  page?: number;
  pageSize?: number;
  status?: LeadStatusFilter;
  source?: "all" | "demo" | "signup";
  hasPhone?: boolean;
  q?: string;
}): Promise<PaginatedLeads> {
  const s = new URLSearchParams();
  s.set("page", String(params.page ?? 1));
  s.set("page_size", String(params.pageSize ?? 25));
  if (params.status && params.status !== "all") s.set("status", params.status);
  if (params.source && params.source !== "all") s.set("source", params.source);
  if (params.hasPhone != null) s.set("has_phone", String(params.hasPhone));
  if (params.q) s.set("q", params.q);
  return apiClient<PaginatedLeads>(`/admin/leads/?${s}`);
}

export function getLeadStats(): Promise<LeadStats> {
  return apiClient<LeadStats>("/admin/leads/stats");
}
