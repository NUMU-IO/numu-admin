/**
 * Overview — the operator's triage screen.
 *
 * The shape is the design system's: a health bar when something is degraded,
 * a ten-tile strip split into "how the platform is doing" and "what is
 * breaking", two monitoring charts, the orders that need a human, and what
 * staff and the system have been doing.
 *
 * Every number comes from `/admin/dashboard/overview`, which computes them in
 * one pass so no two tiles can disagree. Open support cases renders as a dash
 * rather than a zero: this platform has no support-case table, and a queue
 * that reads zero looks cleared rather than absent.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Banner,
  BarChart,
  Button,
  Card,
  DataTable,
  EmptyState,
  MetricCard,
  NUMU_STATUS,
  RiskScore,
  Skeleton,
  Sparkline,
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import {
  formatCompact,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatRelative,
} from "@/lib/format";
import {
  getAdminOverview,
  type ActivityEntry,
  type AttentionOrder,
  type Trend,
} from "@/services/dashboardService";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

type NumuStatus = keyof typeof NUMU_STATUS;

const ORDER_STATUS: Record<string, NumuStatus> = {
  PENDING: "pending",
  CONFIRMED: "pending",
  PROCESSING: "in_review",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PAYMENT_FAILED: "failed",
  RETURNED: "refunded",
  DRAFT: "draft",
};

/** `+18`, `+6.1%`, `-1.2pp` — the unit comes from the metric, not the caller. */
function delta(t: Trend | null | undefined): string | undefined {
  if (!t || t.delta == null || t.delta === 0) return undefined;
  const sign = t.delta > 0 ? "+" : "";
  const unit = t.delta_unit === "pct" ? "%" : t.delta_unit === "pp" ? "pp" : "";
  return `${sign}${t.delta}${unit}`;
}

/**
 * `+201012345678` → `+2010 †† 45 ††`.
 *
 * The design system masks customer contact details in operational lists: an
 * operator needs to recognise a number they were already given, not to be
 * able to read one off the screen.
 */
function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 9) return phone;
  return `${digits.slice(0, 5)} †† ${digits.slice(7, 9)} ††`;
}

export default function Home() {
  const [, navigate] = useLocation();

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: getAdminOverview,
    refetchInterval: 60_000,
  });

  const m = data?.metrics;
  const e = data?.earnings;

  const orderColumns: DataTableColumn<AttentionOrder>[] = [
    { key: "order_number", header: "Order", mono: true },
    {
      key: "store",
      header: "Store",
      render: (o) => (
        <div>
          <div className="ntb__primary">{o.store_name}</div>
          <div className="ntb__sub numu-id">{o.store_id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div>
          <div>{o.customer_name || "Guest"}</div>
          <div className="ntb__sub numu-phone">{maskPhone(o.customer_phone)}</div>
        </div>
      ),
    },
    {
      key: "payment_method",
      header: "Method",
      render: (o) => (
        <Badge tone="neutral" square>
          {(o.payment_method || "—").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusBadge status={ORDER_STATUS[o.status] ?? "open"} />,
    },
    {
      key: "risk",
      header: "Risk",
      render: (o) =>
        o.risk_score == null ? (
          <span className="numu-mono">—</span>
        ) : (
          <RiskScore score={o.risk_score} inline />
        ),
    },
    {
      key: "total_cents",
      header: "Total",
      align: "end",
      mono: true,
      render: (o) => formatMoney(o.total_cents, o.currency),
    },
  ];

  if (isError) {
    return (
      <DashboardLayout title="Overview">
        <Card>
          <EmptyState
            kind="error"
            title="The overview failed to load"
            body={
              error instanceof Error ? error.message : "The request did not complete."
            }
            action={
              <Button size="sm" icon="refresh" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Overview"
      subtitle={
        dataUpdatedAt
          ? `Current as of ${formatDateTime(new Date(dataUpdatedAt))}. Refreshes every 60 seconds.`
          : "Loading platform counts."
      }
      actions={
        <Button
          variant="subtle"
          icon="refresh"
          loading={isLoading}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      }
    >
      {/* Degraded service. Derived from measurements — this platform has no
          incident records, so nothing here claims to be a named incident. */}
      {data?.health.map((h) => (
        <Banner
          key={h.id}
          tone={h.severity === "danger" ? "danger" : "warning"}
          title={h.title}
          actions={
            <Button
              size="sm"
              variant="subtle"
              icon="activity"
              onClick={() => navigate("/orders")}
            >
              Investigate
            </Button>
          }
        >
          {h.detail}
        </Banner>
      ))}

      {/* Strip one — how the platform is doing. */}
      <div className="ak-metrics">
        <MetricCard
          label="Active merchants"
          value={formatNumber(m?.active_merchants.value)}
          delta={delta(m?.active_merchants)}
          note={m?.active_merchants.note ?? undefined}
          icon="building"
          loading={isLoading}
          sparkline={
            m?.active_merchants.spark.length ? (
              <Sparkline
                data={m.active_merchants.spark}
                label="New merchants per day, last 7 days"
              />
            ) : undefined
          }
          onClick={() => navigate("/merchants")}
        />
        <MetricCard
          label="Active stores"
          value={formatNumber(m?.active_stores.value)}
          delta={delta(m?.active_stores)}
          note={m?.active_stores.note ?? undefined}
          icon="store"
          loading={isLoading}
          onClick={() => navigate("/merchants")}
        />
        <MetricCard
          label="Orders today"
          value={formatNumber(m?.orders_today.value)}
          delta={delta(m?.orders_today)}
          note={m?.orders_today.note ?? undefined}
          icon="cart"
          loading={isLoading}
          sparkline={
            m?.orders_today.spark.length ? (
              <Sparkline data={m.orders_today.spark} area label="Orders per hour today" />
            ) : undefined
          }
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Order value today"
          value={formatMoney(m?.order_value_today.value ?? 0)}
          delta={delta(m?.order_value_today)}
          note={m?.order_value_today.note ?? undefined}
          icon="banknote"
          loading={isLoading}
          sparkline={
            m?.order_value_today.spark.length ? (
              <Sparkline
                data={m.order_value_today.spark}
                label="Paid order value per hour today"
              />
            ) : undefined
          }
        />
        <MetricCard
          label="Trial → paid · 30d"
          value={m ? m.trial_to_paid_30d.value : 0}
          unit="%"
          note={m?.trial_to_paid_30d.note ?? undefined}
          icon="trendingUp"
          loading={isLoading}
        />
      </div>

      {/* Strip two — what is breaking. Each tile opens the page that clears it. */}
      <div className="ak-metrics">
        <MetricCard
          label="Failed payments · 24h"
          value={formatNumber(m?.failed_payments_24h.value)}
          delta={delta(m?.failed_payments_24h)}
          deltaDirection="up"
          note={m?.failed_payments_24h.note ?? undefined}
          icon="creditCard"
          alert={Boolean(m?.failed_payments_24h.value)}
          loading={isLoading}
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Stores requiring review"
          value={formatNumber(m?.stores_requiring_review.value)}
          note={m?.stores_requiring_review.note ?? undefined}
          icon="shieldAlert"
          alert={Boolean(m?.stores_requiring_review.value)}
          loading={isLoading}
          onClick={() => navigate("/merchants")}
        />
        <MetricCard
          label="High-risk COD orders"
          value={formatNumber(m?.high_risk_cod_orders.value)}
          note={m?.high_risk_cod_orders.note ?? undefined}
          icon="shield"
          alert={Boolean(m?.high_risk_cod_orders.value)}
          loading={isLoading}
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Open support cases"
          value="—"
          note="no case system on this platform"
          icon="inbox"
          loading={isLoading}
        />
        <MetricCard
          label="Failed jobs & webhooks"
          value={formatNumber(m?.failed_jobs_webhooks.value)}
          delta={delta(m?.failed_jobs_webhooks)}
          deltaDirection="up"
          note={m?.failed_jobs_webhooks.note ?? undefined}
          icon="gitBranch"
          alert={Boolean(m?.failed_jobs_webhooks.value)}
          loading={isLoading}
        />
      </div>

      {/* What NUMU earns, as distinct from what merchants turn over. The
          separation matters: a wallet top-up is the merchant's cash sitting
          on the platform, and only becomes revenue once it is taken as
          commission. Only the earned half is summed. */}
      <Card
        title="Platform earnings"
        subtitle="Last 30 days · EGP"
        actions={
          <Button size="sm" variant="subtle" onClick={() => navigate("/billing")}>
            Billing
          </Button>
        }
      >
        <div className="ak-stack">
          <div className="ak-metrics ak-metrics--4">
            <MetricCard
              label="Recognised revenue"
              value={formatMoney(e?.recognised_30d ?? 0)}
              note="subscriptions + commission"
              icon="banknote"
              loading={isLoading}
            />
            <MetricCard
              label="MRR"
              value={formatMoney(e?.mrr_cents ?? 0)}
              note={`${formatNumber(e?.mrr_subscribers)} paid plans`}
              icon="trendingUp"
              flat
              loading={isLoading}
            />
            <MetricCard
              label="Subscriptions collected"
              value={formatMoney(e?.subscriptions_collected_30d ?? 0)}
              note="approved receipts"
              icon="clipboard"
              flat
              loading={isLoading}
            />
            <MetricCard
              label="Pay-as-you-go commission"
              value={formatMoney(e?.payg_commission_30d ?? 0)}
              note="net of reversals"
              icon="creditCard"
              flat
              loading={isLoading}
            />
          </div>

          <div className="ak-2col">
            <div className="ak-stack">
              <p className="numu-label">Paid plans</p>
              {Object.entries(e?.plan_counts ?? {}).map(([plan, count]) => (
                <div key={plan} className="ak-row-line">
                  <span className="ak-cell-line" style={{ fontSize: "var(--fs-app-sm)" }}>
                    <Badge tone="neutral" square>
                      {plan}
                    </Badge>
                    {e?.mrr_by_plan[plan] ? (
                      <span className="numu-mono">{formatMoney(e.mrr_by_plan[plan])} / mo</span>
                    ) : (
                      <span className="ak-feed__meta">no recurring charge</span>
                    )}
                  </span>
                  <span className="numu-mono">{formatNumber(count)}</span>
                </div>
              ))}
            </div>

            <div className="ak-stack">
              <p className="numu-label">Merchant money held</p>
              <div className="ak-row-line">
                <span style={{ fontSize: "var(--fs-app-sm)" }}>Top-ups taken in</span>
                <span className="numu-mono">
                  {formatMoney(e?.wallet_topups_collected_30d ?? 0)}
                </span>
              </div>
              <div className="ak-row-line">
                <span style={{ fontSize: "var(--fs-app-sm)" }}>Wallet float outstanding</span>
                <span className="numu-mono">{formatMoney(e?.wallet_float_cents ?? 0)}</span>
              </div>
              <p className="ak-feed__meta">
                Top-ups are merchant cash on the platform, not income. They become
                revenue only as commission is taken against them, which is why
                neither line is added to recognised revenue.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Two monitoring charts. */}
      <div className="ak-2col">
        <Card title="Orders per hour" subtitle="Today · all stores">
          {isLoading ? (
            <Skeleton height={190} variant="block" />
          ) : (
            <BarChart
              data={data?.orders_per_hour ?? []}
              height={190}
              gridLines={2}
              label={`Orders per hour today. ${formatNumber(m?.orders_today.value)} so far.`}
              formatValue={formatCompact}
            />
          )}
        </Card>

        <Card
          title="Failed webhook deliveries"
          subtitle="Per hour · last 24h"
          actions={
            <Button size="sm" variant="subtle" onClick={() => navigate("/settings")}>
              Queue
            </Button>
          }
        >
          {isLoading ? (
            <Skeleton height={190} variant="block" />
          ) : (
            <BarChart
              data={data?.webhook_failures_per_hour ?? []}
              height={190}
              gridLines={2}
              color="var(--viz-2)"
              isHighlighted={(d) =>
                Boolean(
                  data?.webhook_failures_per_hour.find((b) => b.label === d.label)
                    ?.highlight,
                )
              }
              label={`Failed webhook deliveries per hour. ${formatNumber(
                m?.failed_jobs_webhooks.value,
              )} outstanding.`}
              formatValue={formatCompact}
            />
          )}
        </Card>
      </div>

      {/* The queue an operator actually works. */}
      <Card
        title="Orders needing attention"
        subtitle="Pending · failed · high risk"
        flush
        actions={
          <Button
            size="sm"
            variant="subtle"
            iconEnd="arrowRight"
            onClick={() => navigate("/orders")}
          >
            All orders
          </Button>
        }
      >
        <DataTable
          columns={orderColumns}
          rows={data?.orders_needing_attention ?? []}
          rowKey={(o) => o.id}
          dense
          loading={isLoading}
          caption="Orders that are pending, failed, or scored high risk"
          onRowClick={(o) => navigate(`/orders?q=${o.order_number}`)}
          isFlagged={(o) => (o.risk_score ?? 0) >= 60 || o.payment_status === "FAILED"}
          empty={
            <EmptyState
              kind="empty"
              icon="check"
              title="Nothing needs attention"
              body="No order is pending, failed or scored high risk right now."
            />
          }
        />
      </Card>

      {/* Who did what, and what is currently degraded. */}
      <div className="ak-2col--wide ak-2col">
        <Card
          title="Platform activity"
          subtitle="All staff · system actions"
          flush
          actions={
            <Button
              size="sm"
              variant="ghost"
              iconEnd="arrowRight"
              onClick={() => navigate("/settings")}
            >
              Audit log
            </Button>
          }
        >
          {isLoading ? (
            <div style={{ padding: "var(--sp-4)" }}>
              <Skeleton lines={6} />
            </div>
          ) : data?.activity.length ? (
            <div className="ak-feed">
              {data.activity.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyState
              kind="empty"
              icon="history"
              title="No recorded activity"
              body="Staff and system actions appear here as they happen."
            />
          )}
        </Card>

        <Card title="Service health" subtitle="Derived from live signals" flush>
          {isLoading ? (
            <div style={{ padding: "var(--sp-4)" }}>
              <Skeleton lines={4} />
            </div>
          ) : data?.health.length ? (
            <div className="ak-feed">
              {data.health.map((h) => (
                <div key={h.id} className="ak-feed__row">
                  <span className="ak-feed__dot ak-feed__dot--danger" />
                  <div className="ak-feed__body">
                    <div className="ak-cell-line">
                      <StatusBadge
                        status={h.severity === "danger" ? "down" : "degraded"}
                        label={h.severity === "danger" ? "Degraded" : "Watch"}
                      />
                      <span className="numu-label">{h.id}</span>
                    </div>
                    <p className="ak-feed__title">{h.title}</p>
                    <p className="ak-feed__meta">{h.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              kind="empty"
              icon="activity"
              title="All signals within tolerance"
              body="Payment failure and webhook delivery rates are both normal."
            />
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

/** One line of the audit feed: who, what, to which entity, when. */
function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const tone =
    entry.severity === "critical" || entry.severity === "error"
      ? "danger"
      : entry.severity === "warning"
        ? "warning"
        : "info";
  return (
    <div className="ak-feed__row">
      <span className={`ak-feed__dot ak-feed__dot--${tone}`} />
      <div className="ak-feed__body">
        <div className="ak-cell-line">
          <span className="ak-feed__title">{entry.action}</span>
          {entry.actor_type === "system" ? (
            <Badge tone="neutral" icon="zap" square>
              system
            </Badge>
          ) : (
            <span className="numu-email ak-feed__actor">{entry.actor}</span>
          )}
        </div>
        <p className="ak-feed__meta">
          {[entry.entity, entry.note].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <time className="ak-feed__time" dateTime={entry.created_at}>
        {formatRelative(entry.created_at)}
      </time>
    </div>
  );
}
