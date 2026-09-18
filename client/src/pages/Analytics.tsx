/**
 * Analytics — the platform's shape and its month-over-month movement.
 *
 * Charts use the design system's own bar chart and the Navy-led `--viz-*`
 * sequence, so an operational chart never reads as marketing. The doughnut
 * charts are gone: a ring makes an operator estimate angles, and every
 * question this page answers is "how many, and is it more than last month",
 * which a bar and a number answer directly.
 *
 * Money is EGP throughout. It was being formatted as US dollars.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { BarChart, Card, EmptyState, MetricCard, StatusBadge } from "@/ds";
import {
  formatCompact,
  formatDelta,
  formatMoney,
  formatMoneyShort,
  formatNumber,
} from "@/lib/format";
import { getCustomerStats } from "@/services/customerService";
import { getDashboardStats } from "@/services/dashboardService";
import { getMerchantStats } from "@/services/merchantService";
import { getOrderStats } from "@/services/orderService";
import { useQuery } from "@tanstack/react-query";

/** Back-calculate last month from this month plus the reported change. */
function previous(current: number, changePct: number): number {
  if (changePct === 0) return current;
  return Math.round(current / (1 + changePct / 100));
}

export default function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });
  const { data: orderStats } = useQuery({
    queryKey: ["orders", "stats"],
    queryFn: getOrderStats,
  });
  const { data: merchantStats } = useQuery({
    queryKey: ["merchants", "stats"],
    queryFn: getMerchantStats,
  });
  const { data: customerStats } = useQuery({
    queryKey: ["customers", "stats"],
    queryFn: getCustomerStats,
  });

  const revenue = stats?.totalRevenue ?? 0;
  const revenueChange = stats?.revenueChange ?? 0;

  const revenueBars = [
    { label: "Last month", value: Math.round(previous(revenue, revenueChange) / 100) },
    { label: "This month", value: Math.round(revenue / 100) },
  ];

  const orderBars = [
    { label: "Pending", value: orderStats?.pending ?? 0 },
    { label: "Processing", value: orderStats?.processing ?? 0 },
    { label: "Shipped", value: orderStats?.shipped ?? 0 },
    { label: "Delivered", value: orderStats?.delivered ?? 0 },
    { label: "Cancelled", value: orderStats?.cancelled ?? 0 },
  ];

  const merchantBars = [
    { label: "Active", value: merchantStats?.active ?? 0 },
    { label: "Pending", value: merchantStats?.pending_approval ?? 0 },
    { label: "Suspended", value: merchantStats?.suspended ?? 0 },
    { label: "Inactive", value: merchantStats?.inactive ?? 0 },
  ];

  const activeShare =
    customerStats?.total ? Math.round((customerStats.active / customerStats.total) * 100) : 0;

  return (
    <DashboardLayout
      title="Analytics"
      subtitle="Platform totals and month-over-month movement. Amounts in EGP."
    >
      <div className="ak-metrics ak-metrics--4">
        <MetricCard
          label="Revenue, all time"
          value={formatMoneyShort(revenue)}
          delta={formatDelta(revenueChange)}
          note="paid orders"
          icon="banknote"
        />
        <MetricCard
          label="Active merchants"
          value={formatNumber(stats?.activeMerchants)}
          delta={formatDelta(stats?.merchantsChange)}
          note="vs last month"
          icon="building"
        />
        <MetricCard
          label="Orders"
          value={formatNumber(stats?.totalOrders)}
          delta={formatDelta(stats?.ordersChange)}
          note="vs last month"
          icon="cart"
        />
        <MetricCard
          label="Customers"
          value={formatNumber(stats?.totalCustomers)}
          delta={formatDelta(stats?.customersChange)}
          note={`${formatNumber(customerStats?.active)} active`}
          icon="users"
        />
      </div>

      <Card
        title="Monthly recurring revenue"
        subtitle="Annual plans counted at their monthly equivalent"
        actions={
          <StatusBadge
            status="active"
            label={`${formatNumber(stats?.mrr.subscriberCount)} subscribers`}
            icon="users"
          />
        }
      >
        <div className="ak-metrics ak-metrics--4">
          <MetricCard label="Total MRR" value={formatMoneyShort(stats?.mrr.total)} flat />
          <MetricCard
            label="Starter"
            value={formatMoneyShort(
              (stats?.mrr.starterMonthly ?? 0) + (stats?.mrr.starterAnnual ?? 0),
            )}
            note={`${formatMoney(stats?.mrr.starterAnnual)} from annual`}
            flat
          />
          <MetricCard
            label="Pro"
            value={formatMoneyShort(
              (stats?.mrr.proMonthly ?? 0) + (stats?.mrr.proAnnual ?? 0),
            )}
            note={`${formatMoney(stats?.mrr.proAnnual)} from annual`}
            flat
          />
          <MetricCard
            label="Average per subscriber"
            value={formatMoneyShort(
              stats?.mrr.subscriberCount
                ? Math.round(stats.mrr.total / stats.mrr.subscriberCount)
                : 0,
            )}
            flat
          />
        </div>
      </Card>

      <div className="ak-2col">
        <Card
          title="Revenue, month over month"
          subtitle="EGP"
          actions={
            <StatusBadge
              status={revenueChange >= 0 ? "active" : "past_due"}
              label={formatDelta(revenueChange) ?? "no change"}
              icon={revenueChange >= 0 ? "trendingUp" : "trendingDown"}
            />
          }
        >
          <BarChart
            data={revenueBars}
            height={200}
            label={`Revenue last month against this month, in EGP. ${formatDelta(revenueChange) ?? "unchanged"}.`}
            formatValue={formatCompact}
          />
        </Card>

        <Card
          title="Orders by stage"
          subtitle={`${formatNumber(orderStats?.total)} total`}
        >
          {orderStats?.total ? (
            <BarChart
              data={orderBars}
              height={200}
              color="var(--viz-2)"
              label="Order counts by lifecycle stage"
              formatValue={formatCompact}
            />
          ) : (
            <EmptyState kind="empty" title="No orders yet" body="Nothing to chart." />
          )}
        </Card>
      </div>

      <div className="ak-2col">
        <Card
          title="Merchants by status"
          subtitle={`${formatNumber(merchantStats?.total)} total`}
        >
          <BarChart
            data={merchantBars}
            height={200}
            color="var(--viz-3)"
            isHighlighted={(d) => d.label === "Suspended" && d.value > 0}
            label="Merchant counts by store status"
            formatValue={formatCompact}
          />
        </Card>

        <Card title="Month-over-month growth" subtitle="Every headline metric">
          <div className="ak-stack">
            {[
              { metric: "Revenue", change: stats?.revenueChange ?? 0 },
              { metric: "Orders", change: stats?.ordersChange ?? 0 },
              { metric: "Merchants", change: stats?.merchantsChange ?? 0 },
              { metric: "Customers", change: stats?.customersChange ?? 0 },
            ].map((row) => (
              <div key={row.metric} className="ak-row-line">
                <span style={{ fontSize: "var(--fs-app-sm)" }}>{row.metric}</span>
                <StatusBadge
                  status={row.change >= 0 ? "active" : "past_due"}
                  label={`${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)}%`}
                  icon={row.change >= 0 ? "trendingUp" : "trendingDown"}
                />
              </div>
            ))}
            <div className="ak-row-line">
              <span style={{ fontSize: "var(--fs-app-sm)" }}>
                Customers with at least one order
              </span>
              <span className="numu-mono">
                {formatNumber(customerStats?.active)} · {activeShare}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
