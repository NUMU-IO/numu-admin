/**
 * Admin API for merchant-hub nav config.
 *
 * Lets admins hide/show, mark coming-soon, or reorder each tab on the
 * merchant hub left sidebar. Backed by platform_config.key = "merchant_hub_nav".
 */

import { apiClient } from "./api";

export interface MerchantHubNavTab {
  key: string;
  visible: boolean;
  coming_soon: boolean;
  order: number;
}

export interface MerchantHubNavConfig {
  tabs: MerchantHubNavTab[];
}

export async function getMerchantHubNav(): Promise<MerchantHubNavConfig> {
  return apiClient<MerchantHubNavConfig>("/admin/merchant-hub-nav");
}

export async function updateMerchantHubNav(
  config: MerchantHubNavConfig,
): Promise<MerchantHubNavConfig> {
  return apiClient<MerchantHubNavConfig>("/admin/merchant-hub-nav", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/**
 * One entry in the merchant-hub nav registry. `parent` is the key of the
 * top-level tab a sub-tab hangs under (omitted for top-level tabs). The
 * admin page uses it to indent + group children beneath their parent.
 *
 * Keys + order MUST stay in sync with DEFAULT_TABS in the backend
 * (merchant_hub_nav.py) and NAV_REGISTRY in the merchant hub (AppSidebar).
 * Convention: top-level = bare slug; sub-tab = "parent.child".
 */
export interface NavRegistryEntry {
  key: string;
  en: string;
  ar: string;
  parent?: string;
}

export const NAV_REGISTRY: NavRegistryEntry[] = [
  // ── Pinned ────────────────────────────────────────────────────────────
  { key: "dashboard", en: "Home", ar: "الرئيسية" },
  { key: "orders", en: "Orders", ar: "الطلبات" },
  { key: "orders.all", en: "All orders", ar: "كل الطلبات", parent: "orders" },
  { key: "orders.drafts", en: "Drafts", ar: "المسودات", parent: "orders" },
  { key: "orders.abandoned", en: "Abandoned", ar: "السلال المهجورة", parent: "orders" },
  { key: "orders.shipping-labels", en: "Shipping labels", ar: "بوالص الشحن", parent: "orders" },
  { key: "products", en: "Products", ar: "المنتجات" },
  { key: "products.all", en: "All products", ar: "كل المنتجات", parent: "products" },
  { key: "products.categories", en: "Categories", ar: "الفئات", parent: "products" },
  { key: "customers", en: "Customers", ar: "العملاء" },
  // ── Sell & grow ───────────────────────────────────────────────────────
  { key: "online-store", en: "Online Store", ar: "المتجر الإلكتروني" },
  { key: "online-store.overview", en: "Overview", ar: "نظرة عامة", parent: "online-store" },
  { key: "online-store.themes", en: "Themes", ar: "الثيمات", parent: "online-store" },
  { key: "online-store.pages", en: "Pages", ar: "الصفحات", parent: "online-store" },
  { key: "online-store.navigation", en: "Navigation", ar: "التنقل", parent: "online-store" },
  { key: "online-store.preferences", en: "Preferences", ar: "التفضيلات", parent: "online-store" },
  { key: "online-store.checkout-fields", en: "Checkout fields", ar: "حقول الدفع", parent: "online-store" },
  { key: "online-store.my-themes", en: "My themes", ar: "إصداراتي", parent: "online-store" },
  { key: "marketing", en: "Marketing", ar: "التسويق" },
  { key: "marketing.overview", en: "Overview", ar: "نظرة عامة", parent: "marketing" },
  { key: "marketing.coupons", en: "Coupons", ar: "الكوبونات", parent: "marketing" },
  { key: "marketing.promotions", en: "Promotions", ar: "العروض", parent: "marketing" },
  { key: "marketing.gift-cards", en: "Gift cards", ar: "بطاقات الهدايا", parent: "marketing" },
  { key: "marketing.campaigns", en: "Campaigns", ar: "الحملات", parent: "marketing" },
  { key: "marketing.whatsapp", en: "WhatsApp", ar: "واتساب", parent: "marketing" },
  { key: "marketing.email-templates", en: "Email templates", ar: "قوالب البريد", parent: "marketing" },
  { key: "marketing.attribution", en: "Attribution", ar: "الإسناد", parent: "marketing" },
  { key: "marketing.audiences", en: "Audiences", ar: "الجماهير", parent: "marketing" },
  { key: "marketing.referrals", en: "Referrals", ar: "الإحالات", parent: "marketing" },
  { key: "analytics", en: "Analytics", ar: "التحليلات" },
  { key: "analytics.overview", en: "Overview", ar: "نظرة عامة", parent: "analytics" },
  { key: "analytics.sales", en: "Sales", ar: "المبيعات", parent: "analytics" },
  { key: "analytics.orders", en: "Orders", ar: "الطلبات", parent: "analytics" },
  { key: "analytics.customers", en: "Customers", ar: "العملاء", parent: "analytics" },
  { key: "analytics.products", en: "Products", ar: "المنتجات", parent: "analytics" },
  { key: "analytics.funnel", en: "Funnel", ar: "القمع", parent: "analytics" },
  { key: "analytics.reports", en: "Reports", ar: "التقارير", parent: "analytics" },
  { key: "analytics.live", en: "Live", ar: "مباشر", parent: "analytics" },
  { key: "analytics.insights", en: "Insights", ar: "تحليلات ذكية", parent: "analytics" },
  { key: "analytics.forecast", en: "Forecast", ar: "التوقعات", parent: "analytics" },
  { key: "analytics.journey", en: "Journey", ar: "رحلة العميل", parent: "analytics" },
  { key: "analytics.health", en: "Store health", ar: "صحة المتجر", parent: "analytics" },
  // ── Money ─────────────────────────────────────────────────────────────
  { key: "payments", en: "Finance", ar: "المالية" },
  { key: "payments.overview", en: "Overview", ar: "نظرة عامة", parent: "payments" },
  { key: "payments.payouts", en: "Payouts", ar: "التحويلات", parent: "payments" },
  { key: "payments.store-balance", en: "Store balance", ar: "رصيد المتجر", parent: "payments" },
  { key: "payments.invoices", en: "Invoices", ar: "الفواتير", parent: "payments" },
  { key: "payments.payment-setup", en: "Payment setup", ar: "إعداد الدفع", parent: "payments" },
  { key: "payments.billing", en: "Billing", ar: "الاشتراك", parent: "payments" },
  { key: "cod", en: "COD reconcile", ar: "تسوية الاستلام" },
  // ── Operations ────────────────────────────────────────────────────────
  { key: "logistics", en: "Logistics", ar: "الشحن والتوصيل" },
  { key: "logistics.shipments", en: "Shipments", ar: "الشحنات", parent: "logistics" },
  { key: "logistics.zones", en: "Zones", ar: "المناطق", parent: "logistics" },
  { key: "logistics.locations", en: "Locations", ar: "المواقع", parent: "logistics" },
  { key: "channels", en: "Channels", ar: "القنوات" },
  { key: "channels.inbox", en: "Inbox", ar: "الرسائل", parent: "channels" },
  { key: "channels.social", en: "Social", ar: "سوشيال", parent: "channels" },
  { key: "whatsapp", en: "WhatsApp", ar: "واتساب" },
  { key: "whatsapp.inbox", en: "Inbox", ar: "صندوق الوارد", parent: "whatsapp" },
  { key: "whatsapp.campaigns", en: "Campaigns", ar: "الحملات", parent: "whatsapp" },
  { key: "whatsapp.templates", en: "Templates", ar: "القوالب", parent: "whatsapp" },
  { key: "whatsapp.opt-ins", en: "Opt-ins", ar: "اشتراكات العملاء", parent: "whatsapp" },
  { key: "whatsapp.byo", en: "Connect (BYO)", ar: "ربط الحساب", parent: "whatsapp" },
  { key: "whatsapp.dead-letters", en: "Dead letters", ar: "الرسائل الفاشلة", parent: "whatsapp" },
  { key: "staff", en: "Staff", ar: "فريق العمل" },
  { key: "staff.members", en: "Members", ar: "الأعضاء", parent: "staff" },
  { key: "staff.roles", en: "Roles", ar: "الأدوار", parent: "staff" },
  { key: "apps", en: "Apps", ar: "التطبيقات" },
  // ── Footer ────────────────────────────────────────────────────────────
  { key: "notifications", en: "Notifications", ar: "الإشعارات" },
  { key: "settings", en: "Settings", ar: "الإعدادات" },
  { key: "store", en: "Store settings", ar: "إعدادات المتجر" },
];

// Quick label lookup by key. Derived from NAV_REGISTRY so a new entry above
// automatically gets a label here too.
export const TAB_LABELS: Record<string, { en: string; ar: string }> =
  Object.fromEntries(NAV_REGISTRY.map((e) => [e.key, { en: e.en, ar: e.ar }]));

// Parent-key lookup for grouping/indentation in the admin UI.
export const TAB_PARENT: Record<string, string | undefined> =
  Object.fromEntries(NAV_REGISTRY.map((e) => [e.key, e.parent]));

// Fallback used when the backend hasn't shipped `/admin/merchant-hub-nav` yet.
// Derived from NAV_REGISTRY order so a new tab added above appears here too.
export const DEFAULT_TABS: MerchantHubNavTab[] = NAV_REGISTRY.map((e, i) => ({
  key: e.key,
  visible: true,
  coming_soon: false,
  order: i,
}));
