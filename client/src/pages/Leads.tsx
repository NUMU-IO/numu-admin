/**
 * Leads — the acquisition funnel, and the merchants who did not make it.
 *
 * A lead row outlives the tenant it created, so this is the only screen where
 * a merchant who signed up and churned is still visible. That is the reason
 * the funnel counts are absolute rather than percentages: each step counts
 * everyone who ever reached it, so the numbers only ever go down, and the
 * drop between two steps is the thing worth looking at.
 *
 * `plan intent` and `plan` are shown side by side on purpose — someone who
 * clicked pay-as-you-go and ended up on Starter is a conversation, not a bug.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  BarChart,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  MetricCard,
  Pagination,
  Select,
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import { formatCompact, formatDate, formatNumber, formatRelative } from "@/lib/format";
import {
  getLeadStats,
  listLeads,
  type Lead,
  type LeadFilters,
  type LeadStatusFilter,
} from "@/services/leadsApi";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";

const PAGE_SIZE = 25;

const VIEWS: { id: LeadStatusFilter; label: string }[] = [
  { id: "all", label: "All leads" },
  { id: "new", label: "New" },
  { id: "demo_started", label: "Demo started" },
  { id: "registered", label: "Registered" },
  { id: "store_created", label: "Store created" },
  { id: "activated", label: "Activated" },
];

/* ── Facet options ──────────────────────────────────────────────────────
   These mirror the values the merchant qualification form writes, so a
   filter that matches nothing means nobody answered that way — not that the
   option was spelled differently here. */

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

/** One facet dropdown whose empty option clears rather than filters. */
function Facet({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      options={options}
    />
  );
}

const STATUS_BADGE: Record<string, "new" | "trial" | "active" | "draft" | "churned"> = {
  new: "new",
  demo_started: "trial",
  registered: "draft",
  store_created: "draft",
  activated: "active",
  churned: "churned",
};

export default function Leads() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<LeadStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Facet values are held as strings — "" means "any" — so one setter and one
  // clear cover all of them, and the Select's own empty option is the reset.
  const [facets, setFacets] = useState<Record<string, string>>({});

  const setFacet = (key: string, value: string) => {
    setFacets((f) => ({ ...f, [key]: value }));
    // Any filter change resets to page 1. Staying on page 7 of a freshly
    // narrowed result set shows an empty table and reads as a bug.
    setPage(1);
  };
  const activeFacets = Object.values(facets).filter(Boolean).length;
  const clearFacets = () => {
    setFacets({});
    setPage(1);
  };

  const params: LeadFilters = {
    page,
    pageSize: PAGE_SIZE,
    status: view,
    q: search || undefined,
    ...facets,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "list", params],
    queryFn: () => listLeads(params),
  });
  const { data: stats } = useQuery({
    queryKey: ["leads", "stats"],
    queryFn: getLeadStats,
  });

  const funnel = stats?.funnel;
  const funnelBars = funnel
    ? [
        { label: "Leads", value: funnel.leads },
        { label: "Registered", value: funnel.registered },
        { label: "Store", value: funnel.store_created },
        { label: "Product", value: funnel.first_product },
        { label: "Activated", value: funnel.activated },
        { label: "Paying", value: funnel.paying },
      ]
    : [];

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "email",
      header: "Lead",
      render: (l) => (
        <div>
          <div className="ntb__primary">{l.name || "—"}</div>
          <div className="ntb__sub numu-email">{l.email}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Stage",
      render: (l) => (
        <StatusBadge status={STATUS_BADGE[l.status] ?? "draft"} label={l.status} />
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (l) => (
        <div>
          <div>{l.utm_source ?? l.source}</div>
          {l.utm_campaign ? <div className="ntb__sub">{l.utm_campaign}</div> : null}
        </div>
      ),
    },
    {
      key: "plan",
      header: "Intent → plan",
      render: (l) => (
        <span className="ak-cell-line">
          <Badge tone="neutral" square>
            {l.plan_intent ?? "none"}
          </Badge>
          <span className="ak-feed__meta">→</span>
          <Badge tone={l.tenant_plan ? "info" : "neutral"} square>
            {l.tenant_plan ?? "—"}
          </Badge>
        </span>
      ),
    },
    {
      key: "sells_what",
      header: "Sells",
      render: (l) => l.sells_what ?? "—",
    },
    {
      // The number itself, not a badge saying one exists. The API has sent
      // `phone` all along and this page rendered a "Phone ✓" chip from it, so
      // the one thing an operator opens this table to do — call the lead who
      // signed up an hour ago — had to be done from the database.
      key: "has_phone",
      header: "Phone",
      render: (l) => {
        const phone = l.phone ?? l.whatsapp_phone;
        if (!phone) {
          return (
            <Badge tone="neutral" square>
              email only
            </Badge>
          );
        }
        // A second number only earns a line when it differs — most leads give
        // the same one twice, and repeating it is noise in a dense table.
        const whatsapp =
          l.whatsapp_phone && l.whatsapp_phone !== l.phone ? l.whatsapp_phone : null;
        return (
          <div>
            {/* dir=ltr: an E.164 number inside any RTL run renders with the
                leading + thrown to the wrong end. */}
            <a className="numu-mono" href={`tel:${phone}`} dir="ltr">
              {phone}
            </a>
            {whatsapp ? (
              <div className="ntb__sub numu-mono" dir="ltr">
                WhatsApp {whatsapp}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "First seen",
      mono: true,
      render: (l) => formatDate(l.created_at),
    },
    {
      key: "last_seen_at",
      header: "Last seen",
      mono: true,
      render: (l) => (l.last_seen_at ? formatRelative(l.last_seen_at) : "—"),
    },
  ];

  const leads = data?.items ?? [];

  return (
    <DashboardLayout
      title="Leads"
      subtitle="Everyone who started signing up, including the ones who stopped."
      meta={<span>{formatNumber(stats?.total)} total</span>}
    >
      <div className="ak-metrics">
        <MetricCard
          label="Leads"
          value={formatNumber(funnel?.leads)}
          note="ever recorded"
          icon="users"
        />
        <MetricCard
          label="Registered"
          value={formatNumber(funnel?.registered)}
          note={
            funnel?.leads
              ? `${Math.round((funnel.registered / funnel.leads) * 100)}% of leads`
              : undefined
          }
          icon="user"
          flat
        />
        <MetricCard
          label="Created a store"
          value={formatNumber(funnel?.store_created)}
          note={
            funnel?.registered
              ? `${Math.round((funnel.store_created / funnel.registered) * 100)}% of registered`
              : undefined
          }
          icon="store"
          flat
        />
        <MetricCard
          label="Activated"
          value={formatNumber(funnel?.activated)}
          note="took a first paid order"
          icon="check"
          flat
        />
        <MetricCard
          label="Paying"
          value={formatNumber(funnel?.paying)}
          note="on a paid plan or wallet"
          icon="banknote"
          flat
        />
      </div>

      <div className="ak-2col">
        <Card title="Funnel" subtitle="Absolute counts, not percentages">
          {funnelBars.length ? (
            <BarChart
              data={funnelBars}
              height={200}
              label="Merchant acquisition funnel, absolute counts per stage"
              formatValue={formatCompact}
            />
          ) : (
            <EmptyState kind="empty" title="No funnel data" />
          )}
        </Card>

        <Card title="Channels" subtitle="Leads and the stores they produced" flush>
          <DataTable
            columns={[
              { key: "channel", header: "Channel" },
              {
                key: "leads",
                header: "Leads",
                align: "end",
                mono: true,
                render: (c) => formatNumber(c.leads),
              },
              {
                key: "stores_created",
                header: "Stores",
                align: "end",
                mono: true,
                render: (c) => formatNumber(c.stores_created),
              },
              {
                key: "rate",
                header: "Conversion",
                align: "end",
                mono: true,
                render: (c) =>
                  c.leads ? `${Math.round((c.stores_created / c.leads) * 100)}%` : "—",
              },
            ]}
            rows={stats?.channels ?? []}
            rowKey={(c) => c.channel}
            dense
            caption="Acquisition channels"
            empty={<EmptyState kind="empty" title="No channel data yet" />}
          />
        </Card>
      </div>

      <Card flush>
        <FilterBar
          savedViews={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
          activeView={view}
          onViewChange={(id) => {
            setView(id as LeadStatusFilter);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Email, name, phone or subdomain"
          actions={
            <>
              <span className="numu-label">{formatNumber(data?.total)} matching</span>
              {activeFacets ? (
                <Button size="sm" variant="ghost" icon="x" onClick={clearFacets}>
                  Clear {activeFacets}
                </Button>
              ) : null}
            </>
          }
        >
          {/* These build a CALL LIST, not a browse view. "Fashion merchants
              doing 200+ orders a month in Cairo who registered and never sold"
              is the question an operator actually has, and it is only
              answerable if every facet the qualification form collects is
              filterable. */}
          <Facet
            label="Sells"
            value={facets.sellsWhat}
            options={SELLS_WHAT}
            onChange={(v) => setFacet("sellsWhat", v)}
          />
          <Facet
            label="Sells on"
            value={facets.sellsWhereToday}
            options={SELLS_WHERE}
            onChange={(v) => setFacet("sellsWhereToday", v)}
          />
          <Facet
            label="Volume"
            value={facets.monthlyOrdersBand}
            options={ORDER_BANDS}
            onChange={(v) => setFacet("monthlyOrdersBand", v)}
          />
          <Facet
            label="Plan"
            value={facets.plan}
            options={PLANS}
            onChange={(v) => setFacet("plan", v)}
          />
          <Facet
            label="Reachable"
            value={facets.hasPhone}
            options={[
              { value: "true", label: "Has a phone" },
              { value: "false", label: "Email only" },
            ]}
            onChange={(v) => setFacet("hasPhone", v)}
          />
          <Facet
            label="Profile"
            value={facets.businessComplete}
            options={[
              { value: "true", label: "Qualified" },
              { value: "false", label: "Incomplete" },
            ]}
            onChange={(v) => setFacet("businessComplete", v)}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={leads}
          rowKey={(l) => l.id}
          dense
          loading={isLoading}
          caption="Merchant leads"
          onRowClick={(l) =>
            l.tenant_id ? navigate(`/merchants?q=${l.store_subdomain ?? l.email}`) : undefined
          }
          // A lead that reached a store and stopped is the one worth chasing.
          isFlagged={(l) => Boolean(l.store_created_at) && !l.first_order_at}
          empty={
            <EmptyState
              kind={search ? "noResults" : "empty"}
              icon="users"
              title={search ? "Nothing matches" : "No leads yet"}
              body={
                search
                  ? "Search matches email, name, phone or store subdomain."
                  : "A lead is recorded the moment someone starts a demo or a signup."
              }
              action={
                search ? (
                  <Button size="sm" variant="subtle" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </Card>
    </DashboardLayout>
  );
}
