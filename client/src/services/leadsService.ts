/**
 * Merchant leads API service — admin endpoints.
 *
 * Every person who reached for NUMU through either front door, whether or
 * not they became a tenant. This is the table sales works from: the
 * merchants list only ever shows people who got all the way to a store,
 * which is to say it hides everyone who stalled — the ones worth calling.
 */

import { apiClient } from "@/lib/apiClient";

export interface Lead {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  language: string | null;
  source: string;
  lastSource: string | null;
  status: LeadStatus;
  planIntent: string | null;

  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  landingPath: string | null;

  sellsWhat: string | null;
  sellsWhereToday: string | null;
  monthlyOrdersBand: string | null;
  city: string | null;

  tenantId: string | null;
  storeSubdomain: string | null;
  /** The plan they are actually on — not the card they clicked. */
  tenantPlan: string | null;
  tenantLifecycle: string | null;

  isRegisteredBusiness: boolean | null;
  hasPayoutAccount: boolean;
  businessComplete: boolean;

  demoStartedAt: Date | null;
  registeredAt: Date | null;
  storeCreatedAt: Date | null;
  firstProductAt: Date | null;
  firstOrderAt: Date | null;
  firstCommissionAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  hasPhone: boolean;
}

export type LeadStatus =
  | "new"
  | "demo_started"
  | "registered"
  | "store_created"
  | "activated";

export interface LeadFilters {
  page?: number;
  pageSize?: number;
  status?: LeadStatus | "all";
  source?: "all" | "demo" | "signup";
  utmSource?: string;
  utmCampaign?: string;
  hasPhone?: boolean;
  sellsWhat?: string;
  sellsWhereToday?: string;
  monthlyOrdersBand?: string;
  city?: string;
  plan?: string;
  planIntent?: string;
  lifecycleState?: string;
  isRegisteredBusiness?: boolean;
  businessComplete?: boolean;
  activated?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sort?: "created_desc" | "created_asc" | "last_seen_desc" | "activated_desc";
  q?: string;
}

export interface LeadsPage {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  withPhone: number;
  channels: { channel: string; leads: number; storesCreated: number }[];
  funnel: {
    leads: number;
    registered: number;
    storeCreated: number;
    firstProduct: number;
    activated: number;
    paying: number;
  };
  bySellsWhat: Record<string, number>;
  byOrdersBand: Record<string, number>;
  bySellsWhere: Record<string, number>;
  byPlan: Record<string, number>;
  businessProfilesComplete: number;
}

interface ApiLead {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  language: string | null;
  source: string;
  last_source: string | null;
  status: LeadStatus;
  plan_intent: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  sells_what: string | null;
  sells_where_today: string | null;
  monthly_orders_band: string | null;
  city: string | null;
  tenant_id: string | null;
  store_subdomain: string | null;
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

const toDate = (v: string | null): Date | null => (v ? new Date(v) : null);

function mapLead(r: ApiLead): Lead {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    whatsappPhone: r.whatsapp_phone,
    language: r.language,
    source: r.source,
    lastSource: r.last_source,
    status: r.status,
    planIntent: r.plan_intent,
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
    referrer: r.referrer,
    landingPath: r.landing_path,
    sellsWhat: r.sells_what,
    sellsWhereToday: r.sells_where_today,
    monthlyOrdersBand: r.monthly_orders_band,
    city: r.city,
    tenantId: r.tenant_id,
    storeSubdomain: r.store_subdomain,
    tenantPlan: r.tenant_plan,
    tenantLifecycle: r.tenant_lifecycle,
    isRegisteredBusiness: r.is_registered_business,
    hasPayoutAccount: r.has_payout_account,
    businessComplete: r.business_complete,
    demoStartedAt: toDate(r.demo_started_at),
    registeredAt: toDate(r.registered_at),
    storeCreatedAt: toDate(r.store_created_at),
    firstProductAt: toDate(r.first_product_at),
    firstOrderAt: toDate(r.first_order_at),
    firstCommissionAt: toDate(r.first_commission_at),
    lastSeenAt: toDate(r.last_seen_at),
    createdAt: new Date(r.created_at),
    hasPhone: r.has_phone,
  };
}

/** camelCase filter -> snake_case query param. */
const PARAM_NAMES: Record<keyof LeadFilters, string> = {
  page: "page",
  pageSize: "page_size",
  status: "status",
  source: "source",
  utmSource: "utm_source",
  utmCampaign: "utm_campaign",
  hasPhone: "has_phone",
  sellsWhat: "sells_what",
  sellsWhereToday: "sells_where_today",
  monthlyOrdersBand: "monthly_orders_band",
  city: "city",
  plan: "plan",
  planIntent: "plan_intent",
  lifecycleState: "lifecycle_state",
  isRegisteredBusiness: "is_registered_business",
  businessComplete: "business_complete",
  activated: "activated",
  createdFrom: "created_from",
  createdTo: "created_to",
  sort: "sort",
  q: "q",
};

export async function getLeads(filters: LeadFilters = {}): Promise<LeadsPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // `false` is a meaningful filter value ("has no phone"), so only
    // undefined, null and "" are treated as absent.
    if (value === undefined || value === null || value === "") continue;
    const name = PARAM_NAMES[key as keyof LeadFilters];
    if (name) params.set(name, String(value));
  }

  const res = await apiClient<{
    items: ApiLead[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>(`/admin/leads/?${params.toString()}`);

  return {
    items: res.items.map(mapLead),
    total: res.total,
    page: res.page,
    pageSize: res.page_size,
    totalPages: res.total_pages,
  };
}

export async function getLeadStats(): Promise<LeadStats> {
  const r = await apiClient<{
    total: number;
    by_status: Record<string, number>;
    with_phone: number;
    channels: { channel: string; leads: number; stores_created: number }[];
    funnel: {
      leads: number;
      registered: number;
      store_created: number;
      first_product: number;
      activated: number;
      paying: number;
    };
    by_sells_what: Record<string, number>;
    by_orders_band: Record<string, number>;
    by_sells_where: Record<string, number>;
    by_plan: Record<string, number>;
    business_profiles_complete: number;
  }>("/admin/leads/stats");

  return {
    total: r.total,
    byStatus: r.by_status,
    withPhone: r.with_phone,
    channels: r.channels.map((c) => ({
      channel: c.channel,
      leads: c.leads,
      storesCreated: c.stores_created,
    })),
    funnel: {
      leads: r.funnel.leads,
      registered: r.funnel.registered,
      storeCreated: r.funnel.store_created,
      firstProduct: r.funnel.first_product,
      activated: r.funnel.activated,
      paying: r.funnel.paying,
    },
    bySellsWhat: r.by_sells_what,
    byOrdersBand: r.by_orders_band,
    bySellsWhere: r.by_sells_where,
    byPlan: r.by_plan,
    businessProfilesComplete: r.business_profiles_complete,
  };
}
