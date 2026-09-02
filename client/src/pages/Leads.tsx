/**
 * Leads Page — NUMU Admin Dashboard
 *
 * Everyone who reached for NUMU, whether or not they became a merchant.
 * The Merchants page only shows people who made it all the way to a
 * store, which means it hides everyone who stalled — and the ones who
 * stalled are the ones worth a phone call.
 *
 * Three things this page is built around:
 *
 * 1. The funnel is absolute counts, not percentages. Percentages hide
 *    whether a 40% drop is four people or four hundred.
 * 2. Intent and reality sit side by side. A merchant who clicked "Pay as
 *    you Grow" and ended up on Starter is a pricing signal, and you can
 *    only see it if both are on the row.
 * 3. Filters are for building call lists. "Fashion merchants doing 200+
 *    orders who have not added a product yet" is the question sales
 *    actually asks; every control here exists to make that one query.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getLoginUrl } from "@/const";
import { useQuery } from "@tanstack/react-query";
import {
  getLeads,
  getLeadStats,
  type Lead,
  type LeadFilters,
} from "@/services/leadsService";
import {
  BadgeCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
  Search,
  ShoppingBag,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

/* ─────────────────────────── Option data ─────────────────────────── */

const ANY = "__any__";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "demo_started", label: "Tried demo" },
  { value: "registered", label: "Registered" },
  { value: "store_created", label: "Store created" },
  { value: "activated", label: "Activated" },
];

const SELLS_WHAT = [
  { value: "fashion", label: "Fashion" },
  { value: "electronics", label: "Electronics" },
  { value: "beauty", label: "Beauty" },
  { value: "home", label: "Home" },
  { value: "food", label: "Food" },
  { value: "accessories", label: "Accessories" },
  { value: "other", label: "Other" },
];

const SELLS_WHERE = [
  { value: "instagram", label: "Instagram / Facebook" },
  { value: "shopify", label: "Shopify" },
  { value: "zid", label: "Zid" },
  { value: "salla", label: "Salla" },
  { value: "own_site", label: "Own site" },
  { value: "offline", label: "Physical shop" },
  { value: "nowhere", label: "Not selling yet" },
];

const ORDER_BANDS = [
  { value: "0", label: "Not started" },
  { value: "1-50", label: "Under 50" },
  { value: "51-200", label: "50 – 200" },
  { value: "201-1000", label: "200 – 1,000" },
  { value: "1000+", label: "Over 1,000" },
];

const PLANS = [
  { value: "payg", label: "Pay as you Grow" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
];

const STATUS_TONE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  demo_started: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  registered: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  store_created: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  activated: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const EMPTY: LeadFilters = { page: 1, pageSize: 50, sort: "created_desc" };

/* ─────────────────────────── Small pieces ─────────────────────────── */

function FunnelBar({
  label,
  value,
  total,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  icon: React.ElementType;
}) {
  // Share of the top of the funnel, so every bar is comparable to every
  // other. A step-over-previous-step number would make the last step look
  // healthy purely because so few people reached it.
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  data,
  labels,
  onPick,
}: {
  title: string;
  data: Record<string, number>;
  labels?: { value: string; label: string }[];
  onPick?: (value: string) => void;
}) {
  const rows = Object.entries(data).slice(0, 6);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  const nameOf = (k: string) =>
    labels?.find((l) => l.value === k)?.label ?? k;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No answers yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => onPick?.(key)}
              disabled={!onPick}
              className="flex w-full items-center gap-3 text-left disabled:cursor-default"
            >
              <span className="w-28 shrink-0 truncate text-sm">
                {nameOf(key)}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-foreground/50"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A filter dropdown whose "any" option clears rather than filters. */
function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  anyLabel,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  anyLabel: string;
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(v) => onChange(v === ANY ? undefined : v)}
    >
      <SelectTrigger className="h-9 w-[170px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContactCell({ lead }: { lead: Lead }) {
  if (!lead.phone) {
    return (
      <span className="text-xs text-muted-foreground">No number</span>
    );
  }
  return (
    <div className="space-y-0.5">
      <a
        href={`tel:${lead.phone}`}
        className="flex items-center gap-1.5 text-sm hover:underline"
      >
        <Phone className="h-3 w-3 text-muted-foreground" />
        <span className="tabular-nums">{lead.phone}</span>
      </a>
      {lead.whatsappPhone && (
        // Only rendered when it diverges — NULL means "same as phone",
        // and showing the same number twice would imply otherwise.
        <a
          href={`https://wa.me/${lead.whatsappPhone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
        >
          <MessageCircle className="h-3 w-3" />
          <span className="tabular-nums">{lead.whatsappPhone}</span>
        </a>
      )}
    </div>
  );
}

function PlanCell({ lead }: { lead: Lead }) {
  const diverged =
    lead.planIntent && lead.tenantPlan && lead.planIntent !== lead.tenantPlan;

  if (!lead.tenantPlan && !lead.planIntent) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-0.5">
      {lead.tenantPlan && (
        <Badge variant="secondary" className="font-normal">
          {lead.tenantPlan}
        </Badge>
      )}
      {lead.planIntent && (
        <p
          className={
            diverged
              ? "text-xs text-amber-600 dark:text-amber-400"
              : "text-xs text-muted-foreground"
          }
        >
          wanted {lead.planIntent}
        </p>
      )}
    </div>
  );
}

/** Filled dots for the milestones this merchant has passed. */
function JourneyCell({ lead }: { lead: Lead }) {
  const steps = [
    { at: lead.registeredAt, label: "Registered", icon: UserPlus },
    { at: lead.storeCreatedAt, label: "Store created", icon: Store },
    { at: lead.firstProductAt, label: "First product", icon: Package },
    { at: lead.firstOrderAt, label: "First paid order", icon: ShoppingBag },
    { at: lead.firstCommissionAt, label: "First commission", icon: Banknote },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {steps.map(({ at, label, icon: Icon }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <span
                className={
                  at
                    ? "rounded-md bg-foreground/10 p-1 text-foreground"
                    : "rounded-md p-1 text-muted-foreground/30"
                }
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {label}
              {at ? ` — ${at.toLocaleDateString()}` : " — not yet"}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function Leads() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY);
  const [search, setSearch] = useState("");

  const set = (patch: Partial<LeadFilters>) =>
    // Any filter change resets to page 1 — staying on page 7 of a
    // freshly narrowed result set shows an empty table and reads as a bug.
    setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const { data: stats } = useQuery({
    queryKey: ["lead-stats"],
    queryFn: getLeadStats,
    enabled: !!user,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => getLeads(filters),
    enabled: !!user,
  });

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([k, v]) =>
          !["page", "pageSize", "sort"].includes(k) &&
          v !== undefined &&
          v !== "" &&
          v !== "all",
      ).length,
    [filters],
  );

  if (authLoading) return <DashboardLayoutSkeleton />;

  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
      return <DashboardLayoutSkeleton />;
    }
    // No OAuth configured (local dev) — fall through and render empty.
  }

  const funnel = stats?.funnel;
  const top = funnel?.leads ?? 0;

  return (
    <DashboardLayout
      title="Leads"
      subtitle="Everyone who reached for NUMU — including the ones who never finished"
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {stats ? stats.total.toLocaleString() : "—"} leads ·{" "}
          {stats ? stats.withPhone.toLocaleString() : "—"} reachable by phone ·{" "}
          {stats ? stats.businessProfilesComplete.toLocaleString() : "—"}{" "}
          commercially ready
        </p>

        {/* Funnel — absolute counts, each as a share of all leads. */}
        {funnel && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <FunnelBar label="Leads" value={funnel.leads} total={top} icon={Users} />
            <FunnelBar
              label="Registered"
              value={funnel.registered}
              total={top}
              icon={UserPlus}
            />
            <FunnelBar
              label="Store"
              value={funnel.storeCreated}
              total={top}
              icon={Store}
            />
            <FunnelBar
              label="Product"
              value={funnel.firstProduct}
              total={top}
              icon={Package}
            />
            <FunnelBar
              label="Activated"
              value={funnel.activated}
              total={top}
              icon={ShoppingBag}
            />
            <FunnelBar
              label="Paying"
              value={funnel.paying}
              total={top}
              icon={Banknote}
            />
          </div>
        )}

        {/* Who our merchants are. Clicking a bar filters the table. */}
        {stats && (
          <div className="grid gap-3 md:grid-cols-3">
            <Breakdown
              title="What they sell"
              data={stats.bySellsWhat}
              labels={SELLS_WHAT}
              onPick={(v) => set({ sellsWhat: v })}
            />
            <Breakdown
              title="Where they sell today"
              data={stats.bySellsWhere}
              labels={SELLS_WHERE}
              onPick={(v) => set({ sellsWhereToday: v })}
            />
            <Breakdown
              title="Monthly orders"
              data={stats.byOrdersBand}
              labels={ORDER_BANDS}
              onPick={(v) => set({ monthlyOrdersBand: v })}
            />
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative min-w-[240px] flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                set({ q: search.trim() || undefined });
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Email, name, phone or subdomain…"
                className="h-9 pl-9"
              />
            </form>

            <FilterSelect
              value={filters.status === "all" ? undefined : filters.status}
              onChange={(v) => set({ status: (v as LeadFilters["status"]) })}
              options={STATUSES}
              placeholder="Stage"
              anyLabel="Any stage"
            />
            <FilterSelect
              value={filters.sellsWhat}
              onChange={(v) => set({ sellsWhat: v })}
              options={SELLS_WHAT}
              placeholder="Sells what"
              anyLabel="Any type"
            />
            <FilterSelect
              value={filters.sellsWhereToday}
              onChange={(v) => set({ sellsWhereToday: v })}
              options={SELLS_WHERE}
              placeholder="Sells where"
              anyLabel="Anywhere"
            />
            <FilterSelect
              value={filters.monthlyOrdersBand}
              onChange={(v) => set({ monthlyOrdersBand: v })}
              options={ORDER_BANDS}
              placeholder="Order volume"
              anyLabel="Any volume"
            />
            <FilterSelect
              value={filters.plan}
              onChange={(v) => set({ plan: v })}
              options={PLANS}
              placeholder="Plan"
              anyLabel="Any plan"
            />
            <FilterSelect
              value={filters.planIntent}
              onChange={(v) => set({ planIntent: v })}
              options={PLANS}
              placeholder="Wanted plan"
              anyLabel="Any intent"
            />
            <FilterSelect
              value={
                filters.hasPhone === undefined ? undefined : String(filters.hasPhone)
              }
              onChange={(v) => set({ hasPhone: v === undefined ? undefined : v === "true" })}
              options={[
                { value: "true", label: "Has a number" },
                { value: "false", label: "No number" },
              ]}
              placeholder="Reachable"
              anyLabel="Any"
            />
            <FilterSelect
              value={
                filters.businessComplete === undefined
                  ? undefined
                  : String(filters.businessComplete)
              }
              onChange={(v) =>
                set({ businessComplete: v === undefined ? undefined : v === "true" })
              }
              options={[
                { value: "true", label: "Ready" },
                { value: "false", label: "Not ready" },
              ]}
              placeholder="Commercial"
              anyLabel="Any readiness"
            />
            <FilterSelect
              value={filters.sort}
              onChange={(v) =>
                setFilters((f) => ({ ...f, sort: (v ?? "created_desc") as never }))
              }
              options={[
                { value: "created_desc", label: "Newest first" },
                { value: "created_asc", label: "Oldest first" },
                { value: "last_seen_desc", label: "Recently active" },
                { value: "activated_desc", label: "Recently activated" },
              ]}
              placeholder="Sort"
              anyLabel="Newest first"
            />

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => {
                  setFilters(EMPTY);
                  setSearch("");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear {activeFilterCount}
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Journey</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No leads match these filters.
                  </TableCell>
                </TableRow>
              )}

              {data?.items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium">{lead.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                      {lead.city && (
                        <p className="text-xs text-muted-foreground">{lead.city}</p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <ContactCell lead={lead} />
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      {lead.sellsWhat ? (
                        <Badge variant="outline" className="font-normal">
                          {SELLS_WHAT.find((s) => s.value === lead.sellsWhat)?.label ??
                            lead.sellsWhat}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not qualified
                        </span>
                      )}
                      {lead.monthlyOrdersBand && (
                        <p className="text-xs text-muted-foreground">
                          {ORDER_BANDS.find((b) => b.value === lead.monthlyOrdersBand)
                            ?.label ?? lead.monthlyOrdersBand}{" "}
                          orders/mo
                        </p>
                      )}
                      {lead.sellsWhereToday && (
                        <p className="text-xs text-muted-foreground">
                          from{" "}
                          {SELLS_WHERE.find((s) => s.value === lead.sellsWhereToday)
                            ?.label ?? lead.sellsWhereToday}
                        </p>
                      )}
                      {lead.businessComplete && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <BadgeCheck className="h-3 w-3" />
                          Commercially ready
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <PlanCell lead={lead} />
                  </TableCell>

                  <TableCell>
                    <JourneyCell lead={lead} />
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm">{lead.utmSource ?? "direct"}</p>
                      {lead.utmCampaign && (
                        <p className="text-xs text-muted-foreground">
                          {lead.utmCampaign}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          STATUS_TONE[lead.status] ?? "bg-muted"
                        }`}
                      >
                        {STATUSES.find((s) => s.value === lead.status)?.label ??
                          lead.status}
                      </span>
                      {lead.storeSubdomain && (
                        <a
                          href={`https://${lead.storeSubdomain}.numueg.app`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                        >
                          {lead.storeSubdomain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right text-xs text-muted-foreground">
                    {(lead.lastSeenAt ?? lead.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {data.page} of {data.totalPages} · {data.total.toLocaleString()}{" "}
              leads
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                }
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                }
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
