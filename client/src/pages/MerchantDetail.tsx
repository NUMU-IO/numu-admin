/**
 * Merchant detail — one store, everything about it.
 *
 * The design system's entity-page rules drive the layout: breadcrumbs place
 * the store in the hierarchy, the header carries the status badges and only
 * store-scoped actions, and the identifying facts (ID, plan, domain, created
 * date) sit in the mono meta line rather than being buried in a card.
 *
 * One backend call renders the whole page: store identity and status, tenant
 * lifecycle and billing, the demo-lead capture, the owner account, the
 * pay-as-you-go wallet, commerce metrics and the five most recent orders.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { WhatsAppTransportPanel } from "@/components/merchants/WhatsAppTransportPanel";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  KeyValue,
  MetricCard,
  NUMU_STATUS,
  StatusBadge,
  type DataTableColumn,
  type KeyValueItem,
} from "@/ds";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  getMerchantDetail,
  type MerchantDetail as MerchantDetailData,
} from "@/services/merchantService";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";

type NumuStatus = keyof typeof NUMU_STATUS;
type RecentOrder = MerchantDetailData["recent_orders"][number];

const STORE_STATUS: Record<string, NumuStatus> = {
  active: "active",
  pending_approval: "pending",
  suspended: "suspended",
  inactive: "archived",
};

const LIFECYCLE_STATUS: Record<string, NumuStatus> = {
  active: "active",
  trial: "trial",
  demo: "draft",
  read_only: "past_due",
  cancelled: "churned",
};

const ORDER_STATUS: Record<string, NumuStatus> = {
  pending: "pending",
  processing: "in_review",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
  payment_failed: "failed",
};

const dash = (v: string | null | undefined) => v ?? "—";

export default function MerchantDetail() {
  const [, params] = useRoute("/merchants/:merchantId");
  const [, navigate] = useLocation();
  const storeId = params?.merchantId ?? "";

  const detail = useQuery<MerchantDetailData>({
    queryKey: ["merchant-detail", storeId],
    queryFn: () => getMerchantDetail(storeId),
    enabled: Boolean(storeId),
  });

  if (detail.isLoading) return <DashboardLayoutSkeleton />;

  const d = detail.data;

  if (detail.isError || !d) {
    return (
      <DashboardLayout
        title="Merchant"
        breadcrumbs={[
          { label: "Admin", href: "/" },
          { label: "Merchants", href: "/merchants" },
          { label: storeId },
        ]}
      >
        <Card>
          <EmptyState
            kind="error"
            title="Merchant failed to load"
            body={
              detail.error instanceof Error
                ? detail.error.message
                : `No store answered for ${storeId}.`
            }
            action={
              <Button size="sm" onClick={() => detail.refetch()}>
                Try again
              </Button>
            }
            secondaryAction={
              <Button size="sm" variant="subtle" onClick={() => navigate("/merchants")}>
                Back to merchants
              </Button>
            }
          />
        </Card>
      </DashboardLayout>
    );
  }

  const currency = d.store.default_currency ?? "EGP";
  const domain =
    d.store.custom_domain ??
    (d.store.subdomain ? `${d.store.subdomain}.numueg.app` : d.store.slug);

  const planItems: KeyValueItem[] = [
    { label: "Plan", value: dash(d.tenant?.plan) },
    { label: "Lifecycle", value: dash(d.tenant?.lifecycle_state) },
    { label: "Billing cycle", value: dash(d.tenant?.billing_cycle) },
    { label: "Expires", value: formatDateTime(d.tenant?.expires_at), mono: true },
    { label: "Next renewal", value: formatDateTime(d.tenant?.next_renewal_at), mono: true },
    {
      label: "Card",
      value: d.tenant?.payment_method_last4 ? `•••• ${d.tenant.payment_method_last4}` : "—",
      mono: true,
    },
    { label: "Trial started", value: formatDateTime(d.tenant?.trial_started_at), mono: true },
    {
      label: "Go-live exempt",
      value: d.tenant?.feature_flags?.golive_exempt ? "Yes" : "No",
    },
  ];

  const ownerItems: KeyValueItem[] = [
    { label: "Name", value: dash(d.owner?.name) },
    { label: "Email", value: dash(d.owner?.email), mono: true },
    { label: "Phone", value: dash(d.owner?.phone), mono: true },
    { label: "Status", value: dash(d.owner?.status) },
    { label: "Plan intent", value: dash(d.owner?.plan_intent) },
    { label: "Trial ends", value: formatDateTime(d.owner?.trial_ends_at), mono: true },
    { label: "Last login", value: formatDateTime(d.owner?.last_login_at), mono: true },
    { label: "Registered", value: formatDateTime(d.owner?.created_at), mono: true },
  ];

  const orderColumns: DataTableColumn<RecentOrder>[] = [
    { key: "order_number", header: "Order", mono: true },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusBadge status={ORDER_STATUS[o.status ?? ""] ?? "open"} />,
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (o) => (
        <StatusBadge status={o.payment_status === "paid" ? "paid" : "pending"} />
      ),
    },
    {
      key: "total_cents",
      header: "Value",
      align: "end",
      mono: true,
      render: (o) => formatMoney(o.total_cents, o.currency ?? "EGP"),
    },
    {
      key: "created_at",
      header: "Placed",
      mono: true,
      render: (o) => formatDateTime(o.created_at),
    },
  ];

  return (
    <DashboardLayout
      title={d.store.name}
      breadcrumbs={[
        { label: "Admin", href: "/" },
        { label: "Merchants", href: "/merchants" },
        { label: d.store.name },
      ]}
      badges={
        <>
          <StatusBadge status={STORE_STATUS[d.store.status] ?? "archived"} />
          {d.tenant ? (
            <StatusBadge
              status={LIFECYCLE_STATUS[d.tenant.lifecycle_state ?? ""] ?? "draft"}
              label={d.tenant.lifecycle_state ?? "unknown"}
            />
          ) : null}
          {d.tenant?.plan ? <Badge tone="neutral" square>{d.tenant.plan}</Badge> : null}
        </>
      }
      meta={
        <>
          <span className="numu-id">{d.store.id}</span>
          <span className="numu-domain">{domain}</span>
          <span>created {formatDateTime(d.store.created_at)}</span>
          {d.store.default_currency ? <span>{d.store.default_currency}</span> : null}
        </>
      }
      actions={
        <>
          <Button variant="subtle" icon="arrowLeft" onClick={() => navigate("/merchants")}>
            All merchants
          </Button>
          {d.store.storefront_url ? (
            <Button
              as="a"
              variant="primary"
              iconEnd="externalLink"
              href={d.store.storefront_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open storefront
            </Button>
          ) : null}
        </>
      }
    >
      {d.tenant?.is_demo ? (
        <Banner
          tone="warning"
          icon="flag"
          title="This is a demo tenant, not a paying merchant"
        >
          It is excluded from every platform aggregate and is deleted
          automatically seven days after it was created.
        </Banner>
      ) : null}

      <div className="ak-metrics ak-metrics--4">
        <MetricCard
          label="Orders"
          value={formatNumber(d.metrics.orders_count)}
          note={
            d.metrics.last_order_at
              ? `last ${formatDateTime(d.metrics.last_order_at)}`
              : "none yet"
          }
          icon="cart"
        />
        <MetricCard
          label="Paid revenue"
          value={formatMoney(d.metrics.paid_revenue_cents, currency)}
          icon="banknote"
        />
        <MetricCard
          label="Products"
          value={formatNumber(d.metrics.products_count)}
          icon="package"
        />
        <MetricCard
          label="Customers"
          value={formatNumber(d.metrics.customers_count)}
          icon="users"
        />
      </div>

      {d.tenant?.is_demo ? (
        <Card title="Demo lead" subtitle="Captured on the landing form">
          <KeyValue
            items={[
              { label: "Name", value: dash(d.tenant.demo_name) },
              { label: "Email", value: dash(d.tenant.demo_email), mono: true },
              { label: "WhatsApp", value: dash(d.tenant.demo_whatsapp), mono: true },
              {
                label: "Started",
                value: formatDateTime(d.tenant.demo_started_at),
                mono: true,
              },
            ]}
          />
        </Card>
      ) : null}

      <div className="ak-2col">
        <Card title="Plan and lifecycle" subtitle="Tenant">
          <KeyValue items={planItems} />
        </Card>
        <Card title="Owner account" subtitle="User">
          <KeyValue items={ownerItems} />
        </Card>
      </div>

      {d.wallet ? (
        <Card title="Wallet" subtitle="Pay as you go">
          <KeyValue
            items={[
              {
                label: "Balance",
                value: (
                  <span
                    style={
                      d.wallet.balance_cents < 0
                        ? { color: "var(--status-danger-text)" }
                        : undefined
                    }
                  >
                    {formatMoney(d.wallet.balance_cents, d.wallet.currency)}
                  </span>
                ),
                mono: true,
              },
              {
                label: "On hold",
                value:
                  d.wallet.pending_balance_cents > 0
                    ? formatMoney(d.wallet.pending_balance_cents, d.wallet.currency)
                    : "—",
                mono: true,
              },
              { label: "Status", value: d.wallet.status },
              {
                label: "Commission",
                value:
                  d.wallet.commission_bps_override != null
                    ? `${d.wallet.commission_bps_override / 100}%`
                    : "platform default",
              },
            ]}
          />
        </Card>
      ) : null}

      <Card title="Recent orders" subtitle="Newest first" flush>
        <DataTable
          columns={orderColumns}
          rows={d.recent_orders}
          rowKey={(o) => o.id}
          dense
          caption={`Recent orders for ${d.store.name}`}
          isFlagged={(o) => o.status === "cancelled" || o.payment_status === "failed"}
          empty={
            <EmptyState
              kind="empty"
              title="No orders yet"
              body="This store has not taken an order."
            />
          }
        />
      </Card>

      {/* Which WhatsApp transport this merchant sends through, and the device
          pairing when it is GOWA. It lives here because this is the page staff
          already have open when a merchant calls about it. */}
      <WhatsAppTransportPanel storeId={storeId} storeName={d.store.name} />
    </DashboardLayout>
  );
}
