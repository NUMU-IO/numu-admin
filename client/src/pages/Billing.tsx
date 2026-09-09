/**
 * Billing — what the platform earns, and from whom.
 *
 * Three things changed with the redesign, all because the numbers were
 * wrong rather than because they were ugly.
 *
 * Money is EGP. Every amount on this page is an integer of piasters from
 * the API; it was being formatted as US dollars, so a merchant with
 * EGP 12,400 in orders read as "$12,400".
 *
 * The platform fee is read from the wallet settings the platform actually
 * charges on, not from a 2.5% constant compiled into this file.
 *
 * The payment-provider table is gone. It listed four providers with
 * hardcoded latencies and an "operational" badge, none of it measured, one
 * of them a provider NUMU does not use. A monitoring panel that cannot go
 * red is worse than no monitoring panel.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  BarChart,
  Banner,
  Card,
  DataTable,
  EmptyState,
  MetricCard,
  type DataTableColumn,
} from "@/ds";
import {
  formatCompact,
  formatDelta,
  formatMoney,
  formatMoneyShort,
  formatNumber,
} from "@/lib/format";
import { getDashboardStats } from "@/services/dashboardService";
import { getMerchants } from "@/services/merchantService";
import { getWalletSettings } from "@/services/walletAdminApi";
import { useQuery } from "@tanstack/react-query";

interface PlanRow {
  plan: string;
  merchants: number;
  revenue: number;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Billing() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });

  // One page of merchants is enough to shape the distribution and keeps the
  // request honest: the card says how many merchants it counted.
  const { data: merchantData } = useQuery({
    queryKey: ["merchants", "all-for-billing"],
    queryFn: () => getMerchants({ limit: 200 }),
  });

  const { data: walletSettings } = useQuery({
    queryKey: ["wallet", "settings"],
    queryFn: getWalletSettings,
  });

  const merchants = merchantData?.merchants ?? [];
  const sampled = merchants.length;
  const total = merchantData?.total ?? 0;

  const byPlan = merchants.reduce<Record<string, PlanRow>>((acc, m) => {
    const plan = m.plan || "free";
    const row = acc[plan] ?? { plan, merchants: 0, revenue: 0 };
    row.merchants += 1;
    row.revenue += m.totalRevenue ?? 0;
    acc[plan] = row;
    return acc;
  }, {});

  const planRows = Object.values(byPlan).sort((a, b) => b.revenue - a.revenue);

  const commissionBps = walletSettings?.commission_bps_default ?? null;
  const grossRevenue = stats?.totalRevenue ?? 0;
  // Only pay-as-you-go revenue carries the commission; applying it to gross
  // would overstate platform earnings by the whole subscription base.
  const paygRevenue = byPlan.payg?.revenue ?? 0;
  const commissionEarned =
    commissionBps != null ? Math.round((paygRevenue * commissionBps) / 10_000) : null;

  const columns: DataTableColumn<PlanRow>[] = [
    { key: "plan", header: "Plan", render: (r) => capitalise(r.plan) },
    {
      key: "merchants",
      header: "Merchants",
      align: "end",
      mono: true,
      render: (r) => formatNumber(r.merchants),
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "end",
      mono: true,
      render: (r) => formatMoney(r.revenue),
    },
    {
      key: "avg",
      header: "Average per merchant",
      align: "end",
      mono: true,
      render: (r) => formatMoney(r.merchants ? Math.round(r.revenue / r.merchants) : 0),
    },
  ];

  return (
    <DashboardLayout
      title="Billing"
      subtitle="Subscription revenue, pay-as-you-go commission and plan mix."
    >
      {sampled < total ? (
        <Banner tone="info" icon="info" title="This page counts a sample">
          Plan distribution and revenue-by-plan are computed from the{" "}
          {formatNumber(sampled)} most recent merchants of {formatNumber(total)}. The
          metric tiles above are platform-wide.
        </Banner>
      ) : null}

      <div className="ak-metrics ak-metrics--4">
        <MetricCard
          label="MRR"
          value={formatMoneyShort(stats?.mrr.total)}
          note={`${formatNumber(stats?.mrr.subscriberCount)} subscribers`}
          icon="banknote"
        />
        <MetricCard
          label="Gross merchant revenue"
          value={formatMoneyShort(grossRevenue)}
          delta={formatDelta(stats?.revenueChange)}
          note="paid orders, all time"
          icon="creditCard"
        />
        <MetricCard
          label="Pay-as-you-go commission"
          value={commissionEarned != null ? formatMoneyShort(commissionEarned) : "—"}
          note={
            commissionBps != null
              ? `${commissionBps / 100}% of ${formatMoneyShort(paygRevenue)}`
              : "rate not configured"
          }
          icon="trendingUp"
        />
        <MetricCard
          label="Active merchants"
          value={formatNumber(stats?.activeMerchants)}
          delta={formatDelta(stats?.merchantsChange)}
          note="vs last month"
          icon="building"
        />
      </div>

      <div className="ak-2col">
        <Card title="Merchants per plan" subtitle={`${formatNumber(sampled)} sampled`}>
          {planRows.length ? (
            <BarChart
              data={planRows.map((r) => ({ label: capitalise(r.plan), value: r.merchants }))}
              height={200}
              label="Merchant count per subscription plan"
              formatValue={formatCompact}
            />
          ) : (
            <EmptyState kind="empty" title="No plan data" body="No merchants to group." />
          )}
        </Card>

        <Card title="Revenue per plan" subtitle="EGP, paid orders">
          {planRows.some((r) => r.revenue > 0) ? (
            <BarChart
              data={planRows.map((r) => ({
                label: capitalise(r.plan),
                value: Math.round(r.revenue / 100),
              }))}
              height={200}
              color="var(--viz-2)"
              label="Merchant revenue per subscription plan, in EGP"
              formatValue={formatCompact}
            />
          ) : (
            <EmptyState
              kind="empty"
              title="No revenue yet"
              body="No paid orders in the sampled merchants."
            />
          )}
        </Card>
      </div>

      <Card title="Plan breakdown" subtitle="Sampled merchants" flush>
        <DataTable
          columns={columns}
          rows={planRows}
          rowKey={(r) => r.plan}
          dense
          caption="Merchants and revenue per plan"
          empty={<EmptyState kind="empty" title="No plans to show" />}
        />
      </Card>

      <Card title="Subscription revenue" subtitle="Monthly recurring">
        <div className="ak-stack">
          {[
            { label: "Starter, monthly", value: stats?.mrr.starterMonthly },
            { label: "Starter, annual (monthly equivalent)", value: stats?.mrr.starterAnnual },
            { label: "Pro, monthly", value: stats?.mrr.proMonthly },
            { label: "Pro, annual (monthly equivalent)", value: stats?.mrr.proAnnual },
            { label: "Total MRR", value: stats?.mrr.total },
          ].map((row) => (
            <div key={row.label} className="ak-row-line">
              <span style={{ fontSize: "var(--fs-app-sm)" }}>{row.label}</span>
              <span className="numu-mono">{formatMoney(row.value)}</span>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
