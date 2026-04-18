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

// Nice English labels for UI. Keys must stay in sync with the backend
// DEFAULT_TABS list and NAV_TABS in the merchant hub.
export const TAB_LABELS: Record<string, { en: string; ar: string }> = {
  dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  orders: { en: "Orders", ar: "الطلبات" },
  products: { en: "Products", ar: "المنتجات" },
  categories: { en: "Categories", ar: "الفئات" },
  customers: { en: "Customers", ar: "العملاء" },
  marketing: { en: "Marketing", ar: "التسويق" },
  referrals: { en: "Referrals", ar: "الإحالات" },
  payments: { en: "Payments", ar: "المدفوعات" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  analytics: { en: "Analytics", ar: "التحليلات" },
  "online-store": { en: "Online Store", ar: "المتجر الإلكتروني" },
  staff: { en: "Staff", ar: "الموظفون" },
  channels: { en: "Channels", ar: "القنوات" },
  inbox: { en: "Inbox", ar: "الرسائل" },
  "payment-setup": { en: "Payment Setup", ar: "إعداد الدفع" },
  logistics: { en: "Logistics", ar: "الشحن والتوصيل" },
  cod: { en: "COD", ar: "الدفع عند الاستلام" },
  social: { en: "Social", ar: "السوشيال ميديا" },
  invoices: { en: "Invoices", ar: "الفواتير" },
  billing: { en: "Billing", ar: "الاشتراك والفواتير" },
  notifications: { en: "Notifications", ar: "الإشعارات" },
  settings: { en: "Settings", ar: "الإعدادات" },
  store: { en: "Store Profile", ar: "إعدادات المتجر" },
};

// Fallback used when the backend hasn't shipped `/admin/merchant-hub-nav` yet.
// Derived from TAB_LABELS insertion order so a new tab added above
// automatically appears here too.
export const DEFAULT_TABS: MerchantHubNavTab[] = Object.keys(TAB_LABELS).map(
  (key, i) => ({ key, visible: true, coming_soon: false, order: i }),
);
