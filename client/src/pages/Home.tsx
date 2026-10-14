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
 * when the API sends none: a queue that reads zero looks cleared rather than
 * absent.
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
  formatMoneyShort,
  formatNumber,
  formatRelative,
  humanizeAction,
  sentenceCase,
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

const HEALTH_LABEL: Record<string, string> = {
  payment_failure_rate: "Payment failures",
  webhook_backlog: "Webhook backlog",
  risk_queue: "Risk review queue",
};

/**
 * `+201012345678` → `+2010•••34••`.
 *
 * The design system masks customer contact details in operational lists: an
 * operator needs to recognise a number they were already given, not to be
 * able to read one off the screen.
 */
function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 9) return phone;
  return `${digits.slice(0, 5)}•••${digits.slice(7, 9)}••`;
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
          <div className="ntb__sub numu-phone" dir="ltr">
            {maskPhone(o.customer_phone)}
          </div>
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
            body={error instanceof Error ? error.message : "The request did not complete."}
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
        <Button variant="subtle" icon="refresh" loading={isLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      }
    >
      {/* Degraded service. Derived from measurements — this platform has no
          incident records, so nothing here claims to be a named incident. */}
      {data?.health
        .filter((h) => h.severity !== "ok")
        .map((h) => (
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
          title="Merchants that are switched on, not internal and not demo. Spark = signups per day, last 7 days."
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
          title="Stores with status active whose merchant is live (switched on, not internal, not demo). Delta = stores created this week."
          value={formatNumber(m?.active_stores.value)}
          delta={delta(m?.active_stores)}
          note={m?.active_stores.note ?? undefined}
          icon="store"
          loading={isLoading}
          onClick={() => navigate("/merchants")}
        />
        <MetricCard
          label="Orders today"
          title="Orders created since midnight UTC at live merchants, any status. Delta compares the same hours yesterday."
          value={formatNumber(m?.orders_today.value)}
          delta={delta(m?.orders_today)}
          note={m?.orders_today.note ?? undefined}
          icon="cart"
          loading={isLoading}
          sparkline={
            m?.orders_today.spark.length ? (
              <Sparkline data={m.orders_today.spark} area label="Orders per day, last 14 days" />
            ) : undefined
          }
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Order value today"
          title="Total of orders created since midnight UTC with payment status paid, live merchants only. Delta compares the same hours yesterday."
          value={formatMoneyShort(m?.order_value_today.value)}
          delta={delta(m?.order_value_today)}
          note={m?.order_value_today.note ?? undefined}
          icon="banknote"
          loading={isLoading}
          sparkline={
            m?.order_value_today.spark.length ? (
              <Sparkline
                data={m.order_value_today.spark}
                label="Paid order value per day, last 14 days"
              />
            ) : undefined
          }
        />
        <MetricCard
          label="Trial → paid · 30d"
          title="Of trials started in the last 30 days, the share that has converted to a paid plan. Internal and demo merchants excluded."
          value={formatNumber(m?.trial_to_paid_30d.value)}
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
          title="Orders created in the last 24 hours with payment status failed, live merchants only. Delta compares the 24 hours before."
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
          title="Stores waiting for approval (pending approval) at live merchants."
          value={formatNumber(m?.stores_requiring_review.value)}
          note={m?.stores_requiring_review.note ?? undefined}
          icon="shieldAlert"
          alert={Boolean(m?.stores_requiring_review.value)}
          loading={isLoading}
          onClick={() => navigate("/merchants")}
        />
        <MetricCard
          label="High-risk COD orders"
          title="Open cash-on-delivery orders whose latest risk score is high or critical and that nobody has decided on yet."
          value={formatNumber(m?.high_risk_cod_orders.value)}
          note={m?.high_risk_cod_orders.note ?? undefined}
          icon="shield"
          alert={Boolean(m?.high_risk_cod_orders.value)}
          loading={isLoading}
          onClick={() => navigate("/orders")}
        />
        <MetricCard
          label="Open support cases"
          title="Support cases that are open or pending the merchant. Cases from internal and demo merchants excluded."
          value={m?.open_support_cases ? formatNumber(m.open_support_cases.value) : "—"}
          note={m?.open_support_cases?.note ?? undefined}
          icon="inbox"
          alert={Boolean(m?.open_support_cases?.value)}
          loading={isLoading}
          onClick={() => navigate("/support-cases")}
        />
        <MetricCard
          label="Failed jobs & webhooks"
          title="Webhook deliveries to live merchants' integrations that failed or exhausted their retries. Delta = failures in the last 24 hours."
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
              title="Subscriptions collected plus pay-as-you-go commission, last 30 days. Wallet top-ups are not revenue and are left out."
              value={formatMoneyShort(e?.recognised_30d)}
              note="subscriptions + commission"
              icon="banknote"
              loading={isLoading}
            />
            <MetricCard
              label="MRR"
              title="Monthly price of every active paid plan; annual plans counted at a twelfth of the annual price."
              value={formatMoneyShort(e?.mrr_cents)}
              note={`${formatNumber(e?.mrr_subscribers)} paid plans`}
              icon="trendingUp"
              flat
              loading={isLoading}
            />
            <MetricCard
              label="Subscriptions collected"
              title="Subscription payment receipts approved (manually or by OCR) in the last 30 days."
              value={formatMoneyShort(e?.subscriptions_collected_30d)}
              note="approved receipts"
              icon="clipboard"
              flat
              loading={isLoading}
            />
            <MetricCard
              label="Pay-as-you-go commission"
              title="Commission taken from merchant wallets in the last 30 days, net of reversals."
              value={formatMoneyShort(e?.payg_commission_30d)}
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
                Top-ups are merchant cash on the platform, not income. They become revenue only as
                commission is taken against them, which is why neither line is added to recognised
                revenue.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Two monitoring charts. */}
      <div className="ak-2col">
        <Card title="Orders per day" subtitle="Last 14 days · all stores">
          {isLoading ? (
            <Skeleton height={190} variant="block" />
          ) : (
            <BarChart
              data={data?.orders_per_hour ?? []}
              height={190}
              gridLines={2}
              label={`Orders per day over the last fortnight. ${formatNumber(m?.orders_today.value)} today.`}
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
                Boolean(data?.webhook_failures_per_hour.find((b) => b.label === d.label)?.highlight)
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
              onClick={() => navigate("/audit")}
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
            /* Every signal, with its current reading — including the healthy
               ones. An empty card until something broke made "all clear" and
               "the query returned nothing" look identical, and hid the
               difference between a 2% failure rate and a 9% one on its way to
               breaching. */
            <div className="ak-feed">
              {data.health.map((h) => (
                <div key={h.id} className="ak-feed__row">
                  <span
                    className={`ak-feed__dot ak-feed__dot--${
                      h.severity === "danger"
                        ? "danger"
                        : h.severity === "warning"
                          ? "warning"
                          : "ok"
                    }`}
                  />
                  <div className="ak-feed__body">
                    <div className="ak-cell-line">
                      <StatusBadge
                        status={
                          h.severity === "danger"
                            ? "down"
                            : h.severity === "warning"
                              ? "degraded"
                              : "healthy"
                        }
                        label={
                          h.severity === "danger"
                            ? "Degraded"
                            : h.severity === "warning"
                              ? "Watch"
                              : "Normal"
                        }
                      />
                      <span className="numu-label">{HEALTH_LABEL[h.id] ?? sentenceCase(h.id)}</span>
                    </div>
                    <p className="ak-feed__title">{h.title}</p>
                    <p className="ak-feed__meta">{h.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              kind="error"
              icon="activity"
              title="No signals reported"
              body="The overview returned no health readings at all, which is itself worth looking at."
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
          <span className="ak-feed__title">{humanizeAction(entry.action)}</span>
          {entry.actor_type === "system" ? (
            <Badge tone="neutral" icon="zap" square>
              system
            </Badge>
          ) : (
            <>
              {entry.actor_type === "staff" ? (
                <Badge tone="info" icon="user" square>
                  staff
                </Badge>
              ) : null}
              <span className="numu-email ak-feed__actor">{entry.actor}</span>
            </>
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
