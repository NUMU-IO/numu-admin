/**
 * The admin's information architecture, in one place.
 *
 * The design system's sidebar groups pages by the domain an operator works
 * in rather than by the team that built them, so a support agent chasing an
 * order and a finance operator clearing receipts each have one place to
 * look. The sections below are that model applied to this backoffice's real
 * routes — nothing here is aspirational, every `href` resolves.
 *
 * `queueKey` ties an item to a counter from `/admin/dashboard/queues`. Only
 * items an operator can actually clear carry one: a badge is a claim that
 * work is waiting, so a number that nobody can act on is noise.
 */

import type { NavSection } from "@/ds";
import type { QueueCounts } from "@/services/dashboardService";

export type QueueKey = keyof QueueCounts;

export interface AdminNavItem {
  id: string;
  label: string;
  icon: NavSection["items"][number]["icon"];
  /** Wouter path. Prefix-matched for active state, so nested routes stay lit. */
  href: string;
  queueKey?: QueueKey;
  /** Renders the badge in Terracotta — this queue is breaching, not just full. */
  alertQueue?: boolean;
}

export interface AdminNavSection {
  label?: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavSection[] = [
  {
    items: [{ id: "overview", label: "Overview", icon: "layout", href: "/" }],
  },
  {
    label: "Merchants",
    items: [
      { id: "merchants", label: "Merchants", icon: "building", href: "/merchants" },
      { id: "customers", label: "Customers", icon: "users", href: "/customers" },
      { id: "leads", label: "Leads", icon: "userPlus", href: "/leads" },
      // Sits with Merchants rather than in Operations: it works on the lead
      // list directly, and an operator who has just read the funnel is one
      // click from acting on it.
      { id: "marketing", label: "Marketing", icon: "megaphone", href: "/marketing" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { id: "orders", label: "Orders", icon: "cart", href: "/orders" },
      { id: "analytics", label: "Analytics", icon: "barChart", href: "/analytics" },
      { id: "reports", label: "Reports", icon: "fileText", href: "/reports" },
    ],
  },
  {
    label: "Billing",
    items: [
      { id: "billing", label: "Billing", icon: "creditCard", href: "/billing" },
      { id: "plans", label: "Pricing plans", icon: "tag", href: "/pricing-plans" },
      { id: "limits", label: "Plan limits", icon: "sliders", href: "/plan-limits" },
      {
        id: "wallets",
        label: "Merchant wallets",
        icon: "banknote",
        href: "/wallets",
        queueKey: "walletTopups",
      },
      {
        id: "subscription-payments",
        label: "Subscription payments",
        icon: "clipboard",
        href: "/subscription-payments",
        queueKey: "subscriptionPayments",
      },
      {
        id: "reconciliation",
        label: "Reconciliation",
        icon: "database",
        href: "/reconciliation",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "trust-risk",
        label: "Trust & risk",
        icon: "shieldAlert",
        href: "/trust-risk",
        queueKey: "riskReview",
        alertQueue: true,
      },
      {
        id: "whatsapp",
        label: "WhatsApp & integrations",
        icon: "messageCircle",
        href: "/whatsapp-access",
        queueKey: "whatsappAccess",
      },
      {
        id: "api-tokens",
        label: "API tokens",
        icon: "plug",
        href: "/api-tokens",
      },
      {
        id: "support-cases",
        label: "Support cases",
        icon: "inbox",
        href: "/support-cases",
        queueKey: "supportCases",
      },
      {
        id: "campaigns",
        label: "Notifications & campaigns",
        icon: "megaphone",
        href: "/campaigns",
      },
    ],
  },
  {
    label: "Marketplace",
    items: [
      {
        id: "marketplace-themes",
        label: "Themes",
        icon: "package",
        href: "/marketplace/themes",
      },
      {
        id: "marketplace-review",
        label: "Review queue",
        icon: "shieldAlert",
        href: "/marketplace/review",
        queueKey: "marketplaceReview",
        alertQueue: true,
      },
      {
        id: "snapshots",
        label: "Snapshots",
        icon: "history",
        href: "/marketplace/snapshots",
      },
      { id: "themes", label: "Theme catalogue", icon: "store", href: "/themes" },
      {
        id: "marketplace-reviews",
        label: "Ratings & reviews",
        icon: "star",
        href: "/marketplace-reviews",
      },
    ],
  },
  {
    // Apps plan (docs/Plans/apps-developer-work/05-SURFACES.md § 1). App
    // review, App catalog and Webhook health join this section in Phases 3-4.
    label: "Apps & Partners",
    items: [
      { id: "partners", label: "Partners", icon: "plug", href: "/apps/partners" },
      { id: "app-review", label: "App review", icon: "shieldAlert", href: "/apps/review" },
      { id: "app-catalog", label: "App catalog", icon: "package", href: "/apps/catalog" },
      { id: "partner-notices", label: "Partner notices", icon: "bell", href: "/apps/notices" },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        id: "platform-settings",
        label: "Platform settings",
        icon: "server",
        href: "/platform/settings",
      },
      {
        id: "capabilities",
        label: "Capabilities",
        icon: "plug",
        href: "/platform/capabilities",
      },
      {
        id: "security",
        label: "Security (2FA)",
        icon: "shieldAlert",
        href: "/security",
      },
      {
        id: "hub-nav",
        label: "Merchant hub nav",
        icon: "toggleLeft",
        href: "/merchant-hub-nav",
      },
      { id: "email", label: "Email templates", icon: "mail", href: "/email-templates" },
      {
        id: "landing",
        label: "Landing page",
        icon: "megaphone",
        href: "/landing-page",
      },
      { id: "beta", label: "Beta program", icon: "flag", href: "/beta-program" },
      { id: "settings", label: "Settings", icon: "settings", href: "/settings" },
    ],
  },
];

const ALL_ITEMS = ADMIN_NAV.flatMap((s) => s.items);

/**
 * Which nav item a URL belongs to.
 *
 * Longest match wins so `/marketplace/themes/gilded` lights Themes rather
 * than the shorter `/` overview entry, which would otherwise prefix-match
 * every path in the app.
 */
export function navIdForPath(path: string): string {
  let best: AdminNavItem | undefined;
  for (const item of ALL_ITEMS) {
    const hit =
      item.href === "/" ? path === "/" : path === item.href || path.startsWith(`${item.href}/`);
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.id ?? "";
}

export function navItemById(id: string): AdminNavItem | undefined {
  return ALL_ITEMS.find((i) => i.id === id);
}

/** Breadcrumb trail for a path: the section it lives in, then the page. */
export function navTrailForPath(path: string): { label: string; href?: string }[] {
  const id = navIdForPath(path);
  const section = ADMIN_NAV.find((s) => s.items.some((i) => i.id === id));
  const item = section?.items.find((i) => i.id === id);
  if (!item) return [];
  const trail: { label: string; href?: string }[] = [{ label: "Admin", href: "/" }];
  if (section?.label) trail.push({ label: section.label });
  trail.push({ label: item.label, href: item.href });
  return trail;
}
