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
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import { formatCompact, formatDate, formatNumber, formatRelative } from "@/lib/format";
import {
  getLeadStats,
  listLeads,
  type Lead,
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

  const params = { page, pageSize: PAGE_SIZE, status: view, q: search || undefined };

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
      key: "has_phone",
      header: "Reachable",
      render: (l) =>
        l.has_phone ? (
          <StatusBadge status="verified" label="Phone" icon="phone" />
        ) : (
          <Badge tone="neutral" square>
            email only
          </Badge>
        ),
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
          actions={<span className="numu-label">{formatNumber(data?.total)} matching</span>}
        />
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
