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
 *
 * The Controls card carries the three levers staff reach for most — suspend,
 * change plan, mark internal — each behind a confirmation.
 *
 * A second call (`/admin/merchants/{tenant}/insights`) feeds the rest: store
 * health, API and WhatsApp usage, invoices, support cases and the staff
 * timeline. Billing controls (extend trial, pause billing, credit, refund)
 * sit on the Billing tab, each confirmed with a reason for the audit log.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { ApiAccessPanel } from "@/components/merchants/ApiAccessPanel";
import { ApiTokensPanel } from "@/components/merchants/ApiTokensPanel";
import { EntitlementsPanel } from "@/components/merchants/EntitlementsPanel";
import { WhatsAppTransportPanel } from "@/components/merchants/WhatsAppTransportPanel";
import {
  AuditTimeline,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  MetricCard,
  NUMU_STATUS,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  type DataTableColumn,
  type KeyValueItem,
} from "@/ds";
import {
  formatDateTime,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  humanizeAction,
  parseMoney,
} from "@/lib/format";
import {
  extendTrial,
  getMerchantDetail,
  getMerchantInsights,
  pauseBilling,
  refundInvoice,
  toggleMerchantInternal,
  updateMerchantStatus,
  updateTenant,
  type MerchantDetail as MerchantDetailData,
  type MerchantInsights,
} from "@/services/merchantService";
import { FEATURES_QUERY_KEY, listFeatures } from "@/services/entitlementsAdminApi";
import {
  adjustWallet,
  getWalletDetail,
  type AdminWalletLedgerEntry,
} from "@/services/walletAdminApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
  const tenantId = detail.data?.tenant?.id;
  const insights = useQuery({
    queryKey: ["merchant-insights", tenantId],
    queryFn: () => getMerchantInsights(tenantId!),
    enabled: Boolean(tenantId),
  });
  const ledger = useQuery({
    queryKey: ["admin-wallets", tenantId],
    queryFn: () => getWalletDetail(tenantId!),
    enabled: Boolean(tenantId && detail.data?.wallet),
  });
  const [tab, setTab] = useState("overview");

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
    d.store.custom_domain ?? (d.store.subdomain ? `${d.store.subdomain}.numueg.app` : d.store.slug);

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
    // `trial_ends_at` is stamped on the user row at signup and never cleared,
    // so on a converted merchant it is a date that stopped meaning anything —
    // a pay-as-you-go merchant has no trial at all yet still carries one.
    // Labelled for what it actually is once the tenant says the trial is over.
    {
      label: d.owner?.is_on_trial ? "Trial ends" : "Signed up under trial",
      value: d.owner?.is_on_trial
        ? formatDateTime(d.owner?.trial_ends_at)
        : d.owner?.trial_ends_at
          ? `${formatDateTime(d.owner.trial_ends_at)} — converted`
          : "—",
      mono: true,
    },
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
      render: (o) => <StatusBadge status={o.payment_status === "paid" ? "paid" : "pending"} />,
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

  const ledgerColumns: DataTableColumn<AdminWalletLedgerEntry>[] = [
    { key: "kind", header: "Entry", render: (t) => humanizeAction(t.kind) },
    {
      key: "amount_cents",
      header: "Amount",
      align: "end",
      mono: true,
      render: (t) => formatMoney(t.amount_cents, d.wallet?.currency),
    },
    {
      key: "balance_after_cents",
      header: "Balance after",
      align: "end",
      mono: true,
      render: (t) => formatMoney(t.balance_after_cents, d.wallet?.currency),
    },
    { key: "note", header: "Note", render: (t) => t.note ?? "—" },
    { key: "created_at", header: "When", mono: true, render: (t) => formatDateTime(t.created_at) },
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
          {d.tenant?.plan ? (
            <Badge tone="neutral" square>
              {d.tenant.plan}
            </Badge>
          ) : null}
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
      tabs={
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "billing", label: "Billing" },
            { id: "integrations", label: "API & integrations" },
            { id: "activity", label: "Activity" },
          ]}
          active={tab}
          onChange={setTab}
        />
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
        <Banner tone="warning" icon="flag" title="This is a demo tenant, not a paying merchant">
          It is excluded from every platform aggregate and is deleted automatically seven days after
          it was created.
        </Banner>
      ) : null}

      {tab === "overview" ? (
        <>
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
              value={formatMoneyShort(d.metrics.paid_revenue_cents, currency)}
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

          <ControlsCard d={d} storeId={storeId} />

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

          <HealthCard insights={insights.data} loading={insights.isLoading} />
          <SupportCard insights={insights.data} />
        </>
      ) : null}

      {tab === "billing" ? (
        <>
          {d.tenant ? <BillingPanel d={d} storeId={storeId} insights={insights.data} /> : null}
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
          {d.wallet ? (
            <Card title="Wallet ledger" subtitle="Last 50 entries, newest first" flush>
              <DataTable
                columns={ledgerColumns}
                rows={ledger.data?.ledger ?? []}
                rowKey={(t) => t.id}
                dense
                loading={ledger.isLoading}
                caption={`Wallet ledger for ${d.store.name}`}
                empty={<EmptyState kind="empty" title="No ledger entries" />}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === "overview" ? (
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
      ) : null}

      {tab === "integrations" ? (
        <>
          <UsageCard insights={insights.data} loading={insights.isLoading} />

          {/* Which WhatsApp transport this merchant sends through, and the device
          pairing when it is GOWA. It lives here because this is the page staff
          already have open when a merchant calls about it. */}
          <ApiAccessPanel tenantId={d.tenant?.id} storeName={d.store.name} />

          <ApiTokensPanel tenantId={d.tenant?.id} storeName={d.store.name} />

          <EntitlementsPanel tenantId={d.tenant?.id} />

          <WhatsAppTransportPanel storeId={storeId} storeName={d.store.name} />
        </>
      ) : null}

      {tab === "activity" ? (
        <Card title="Staff timeline" subtitle="Last 50 audit events for this merchant">
          {insights.data?.timeline.length ? (
            <AuditTimeline
              entries={insights.data.timeline.map((e) => ({
                id: e.id,
                action: humanizeAction(e.event_type),
                actor: e.actor_email ?? "system",
                actorType:
                  e.details?.actor_type === "staff"
                    ? "staff"
                    : e.actor_email
                      ? "merchant"
                      : "system",
                timestamp: formatDateTime(e.created_at),
                entity: e.resource_type
                  ? `${e.resource_type} ${e.resource_id ?? ""}`.trim()
                  : undefined,
                note: typeof e.details?.reason === "string" ? e.details.reason : undefined,
              }))}
            />
          ) : (
            <EmptyState
              kind="empty"
              title={insights.isLoading ? "Loading…" : "Nothing recorded yet"}
            />
          )}
        </Card>
      ) : null}
    </DashboardLayout>
  );
}

type Control = "suspend" | "activate" | "plan" | "internal";

/** Suspend / activate, change plan, mark internal — each confirmed first. */
function ControlsCard({ d, storeId }: { d: MerchantDetailData; storeId: string }) {
  const queryClient = useQueryClient();
  const tenantId = d.tenant?.id;
  const currentPlan = d.tenant?.plan ?? "";
  const isInternal = d.tenant?.is_internal ?? false;
  const isActive = d.store.status === "active";
  const [plan, setPlan] = useState(currentPlan);
  const [confirm, setConfirm] = useState<Control | null>(null);

  // The entitlement catalog's plans are the ones the API accepts.
  const catalog = useQuery({ queryKey: FEATURES_QUERY_KEY, queryFn: listFeatures });
  const planOptions = (catalog.data?.plans ?? [])
    .filter((p) => !p.startsWith("addon:"))
    .map((p) => ({ value: p, label: p }));
  if (currentPlan && !planOptions.some((o) => o.value === currentPlan)) {
    planOptions.unshift({ value: currentPlan, label: currentPlan });
  }

  const run = useMutation({
    mutationFn: (c: Control): Promise<unknown> => {
      if (c === "suspend") return updateMerchantStatus(storeId, "suspended");
      if (c === "activate") return updateMerchantStatus(storeId, "active");
      if (c === "plan") return updateTenant(tenantId!, { plan });
      return toggleMerchantInternal(storeId, !isInternal);
    },
    onSuccess: (_r, c) => {
      toast.success(
        c === "suspend"
          ? "Store suspended"
          : c === "activate"
            ? "Store activated"
            : c === "plan"
              ? `Plan changed to ${plan}`
              : isInternal
                ? "Marked as a real merchant"
                : "Marked internal — excluded from platform aggregates",
        { description: `${d.store.name} · recorded in the audit log` },
      );
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ["merchant-detail", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["merchants"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["api-access", tenantId] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const dialog: Record<Control, { title: string; consequences: string[]; label: string }> = {
    suspend: {
      title: `Suspend ${d.store.name}?`,
      consequences: [
        "The storefront stops serving shoppers immediately.",
        "The merchant's API access is off while suspended.",
        "The merchant sees a suspension notice in the Merchant Hub.",
        "Activating the store restores it exactly as it was.",
      ],
      label: "Suspend store",
    },
    activate: {
      title: `Activate ${d.store.name}?`,
      consequences: ["The storefront serves shoppers again.", "The merchant regains hub access."],
      label: "Activate store",
    },
    plan: {
      title: `Change plan to ${plan}?`,
      consequences: [
        `${currentPlan || "No plan"} → ${plan}. Limits and features follow the new plan immediately.`,
        "No charge or refund is made — billing is not touched.",
      ],
      label: "Change plan",
    },
    internal: {
      title: isInternal ? "Mark as a real merchant?" : "Mark as internal?",
      consequences: isInternal
        ? ["The store moves back to the Merchants list.", "It counts in platform aggregates again."]
        : [
            "The store moves to the Internal tab of the Merchants list.",
            "It is excluded from every platform aggregate.",
          ],
      label: isInternal ? "Mark as real" : "Mark as internal",
    },
  };

  return (
    <Card title="Controls" subtitle="Staff actions">
      <div className="ak-stack">
        <div className="ak-row-line">
          <span>Store status</span>
          <Button
            size="sm"
            variant={isActive ? "danger-outline" : "outline"}
            icon={isActive ? "slash" : "playCircle"}
            onClick={() => setConfirm(isActive ? "suspend" : "activate")}
          >
            {isActive ? "Suspend store" : "Activate store"}
          </Button>
        </div>
        <div className="ak-row-line">
          <span>Plan</span>
          <span className="ak-cell-line">
            <Select
              aria-label="Plan"
              value={plan}
              disabled={!tenantId}
              onChange={(e) => setPlan(e.target.value)}
              options={planOptions}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!tenantId || !plan || plan === currentPlan}
              onClick={() => setConfirm("plan")}
            >
              Change plan
            </Button>
          </span>
        </div>
        <div className="ak-row-line">
          <span>Internal</span>
          <Button size="sm" variant="outline" icon="flag" onClick={() => setConfirm("internal")}>
            {isInternal ? "Mark as a real merchant" : "Mark as internal"}
          </Button>
        </div>
      </div>

      {confirm ? (
        <ConfirmDialog
          open
          tone={confirm === "suspend" ? "danger" : "warning"}
          title={dialog[confirm].title}
          entity={[
            { label: "Store", value: d.store.name },
            { label: "Store ID", value: d.store.id, mono: true },
          ]}
          consequences={dialog[confirm].consequences}
          confirmLabel={run.isPending ? "Working…" : dialog[confirm].label}
          onClose={() => setConfirm(null)}
          onConfirm={() => !run.isPending && run.mutate(confirm)}
        />
      ) : null}
    </Card>
  );
}

type Health = MerchantInsights["health"][number];
type Invoice = MerchantInsights["invoices"][number];
type SupportRow = MerchantInsights["support_cases"]["recent"][number];

const pct = (v: number) => `${v}%`;

/** Per-store delivery outcomes over the health-score window (90 days). */
function HealthCard({ insights, loading }: { insights?: MerchantInsights; loading: boolean }) {
  const columns: DataTableColumn<Health>[] = [
    { key: "store_name", header: "Store" },
    {
      key: "grade",
      header: "Grade",
      render: (h) => (h.score == null ? h.grade : `${h.grade} · ${h.score}`),
    },
    {
      key: "cod_success_rate",
      header: "COD success",
      align: "end",
      mono: true,
      render: (h) => pct(h.cod_success_rate),
    },
    {
      key: "cod_rejection_rate",
      header: "COD rejection",
      align: "end",
      mono: true,
      render: (h) => pct(h.cod_rejection_rate),
    },
    {
      key: "return_rate",
      header: "Return rate",
      align: "end",
      mono: true,
      render: (h) => pct(h.return_rate),
    },
    {
      key: "delivery_success_rate",
      header: "Delivered",
      align: "end",
      mono: true,
      render: (h) => pct(h.delivery_success_rate),
    },
    {
      key: "orders_analyzed",
      header: "Orders",
      align: "end",
      mono: true,
      render: (h) => formatNumber(h.orders_analyzed),
    },
  ];
  return (
    <Card title="Store health" subtitle="Last 90 days" flush>
      <DataTable
        columns={columns}
        rows={insights?.health ?? []}
        rowKey={(h) => h.store_id}
        dense
        loading={loading}
        caption="Store health"
        isFlagged={(h) => h.cod_rejection_rate >= 25 || h.return_rate >= 25}
        empty={<EmptyState kind="empty" title="No stores" />}
      />
    </Card>
  );
}

function SupportCard({ insights }: { insights?: MerchantInsights }) {
  const [, navigate] = useLocation();
  const columns: DataTableColumn<SupportRow>[] = [
    { key: "subject", header: "Subject" },
    { key: "status", header: "Status", render: (c) => humanizeAction(c.status) },
    { key: "priority", header: "Priority", render: (c) => humanizeAction(c.priority) },
    {
      key: "created_at",
      header: "Opened",
      mono: true,
      render: (c) => formatDateTime(c.created_at),
    },
  ];
  const open = insights?.support_cases.open ?? 0;
  return (
    <Card
      title="Support cases"
      subtitle={`${formatNumber(open)} open · 10 most recent`}
      flush
      actions={
        <Button size="sm" variant="subtle" onClick={() => navigate("/support-cases")}>
          All cases
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={insights?.support_cases.recent ?? []}
        rowKey={(c) => c.id}
        dense
        caption="Support cases for this merchant"
        isFlagged={(c) => c.priority === "urgent" || c.priority === "high"}
        empty={<EmptyState kind="empty" title="No support cases" />}
      />
    </Card>
  );
}

const limit = (v: number | null) => (v == null ? "unlimited" : formatNumber(v));

/** Public-API traffic (from the daily usage roll-up) and WhatsApp sends. */
function UsageCard({ insights, loading }: { insights?: MerchantInsights; loading: boolean }) {
  const u = insights?.api_usage;
  return (
    <div className="ak-2col">
      <Card title="API usage" subtitle="Last 30 days · today is up to 5 minutes behind">
        {u ? (
          <KeyValue
            items={[
              { label: "Requests · 30d", value: formatNumber(u.requests_30d), mono: true },
              { label: "Requests · today", value: formatNumber(u.requests_today), mono: true },
              { label: "Throttled · 30d", value: formatNumber(u.throttled_30d), mono: true },
              { label: "5xx errors · 30d", value: formatNumber(u.errors_5xx_30d), mono: true },
              { label: "API access", value: u.limits.allowed ? "Allowed" : "Off" },
              { label: "Per minute", value: limit(u.limits.per_minute), mono: true },
              { label: "Per second", value: limit(u.limits.per_second), mono: true },
              { label: "Monthly quota", value: limit(u.limits.monthly_quota), mono: true },
              { label: "Key limit", value: limit(u.limits.key_limit), mono: true },
            ]}
          />
        ) : (
          <EmptyState kind="empty" title={loading ? "Loading…" : "No data"} />
        )}
      </Card>
      <Card title="WhatsApp" subtitle="Template messages sent this calendar month">
        {insights?.whatsapp.length ? (
          <KeyValue
            items={insights.whatsapp.map((w) => ({
              label: w.store_name,
              value: formatNumber(w.messages_this_month),
              mono: true,
            }))}
          />
        ) : (
          <EmptyState kind="empty" title={loading ? "Loading…" : "No stores"} />
        )}
      </Card>
    </div>
  );
}

type BillingAction =
  | { kind: "extend" }
  | { kind: "pause" }
  | { kind: "credit" }
  | { kind: "refund"; invoice: Invoice };

const INVOICE_STATUS: Record<string, NumuStatus> = {
  paid: "paid",
  refunded: "refunded",
  failed: "failed",
  void: "cancelled",
};

/** Extend trial, pause/resume billing, credit the wallet, refund an invoice. */
function BillingPanel({
  d,
  storeId,
  insights,
}: {
  d: MerchantDetailData;
  storeId: string;
  insights?: MerchantInsights;
}) {
  const queryClient = useQueryClient();
  const tenantId = d.tenant!.id;
  const billing = insights?.billing;
  const paused = billing?.paused ?? false;
  // Mirrors the API rule: a live trial, or one the expiry sweep made read-only.
  const canExtend =
    billing?.lifecycle_state === "trial" ||
    (billing?.lifecycle_state === "read_only" && !billing.trial_converted_at);
  const [days, setDays] = useState("7");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<BillingAction | null>(null);
  const dayCount = Number(days);
  const creditCents = parseMoney(amount);
  const currency = d.wallet?.currency ?? "EGP";

  const run = useMutation({
    mutationFn: (a: BillingAction): Promise<unknown> => {
      if (a.kind === "extend") return extendTrial(tenantId, dayCount, reason.trim());
      if (a.kind === "pause") return pauseBilling(tenantId, !paused, reason.trim());
      if (a.kind === "credit") return adjustWallet(tenantId, creditCents!, reason.trim());
      return refundInvoice(tenantId, a.invoice.id, reason.trim());
    },
    onSuccess: (_r, a) => {
      if (a.kind === "refund") {
        toast.success("Invoice marked refunded", {
          description: `Return ${formatMoney(a.invoice.amount_cents, a.invoice.currency)} to the merchant via InstaPay — no money was sent automatically.`,
        });
      } else {
        toast.success(
          a.kind === "extend"
            ? `Trial extended by ${dayCount} days`
            : a.kind === "pause"
              ? paused
                ? "Billing resumed"
                : "Billing paused"
              : `Credited ${formatMoney(creditCents, currency)}`,
          { description: `${d.store.name} · recorded in the audit log` },
        );
      }
      setAction(null);
      setReason("");
      if (a.kind === "credit") setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["merchant-insights", tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-detail", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["merchants"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const dialog = (a: BillingAction): { title: string; consequences: string[]; label: string } => {
    if (a.kind === "extend")
      return {
        title: `Extend the trial by ${dayCount} days?`,
        consequences: [
          `The trial ends ${dayCount} days after the later of now and its current end date.`,
          ...(billing?.lifecycle_state === "read_only"
            ? [
                "The store leaves read-only: the storefront unlocks and the scheduled deletion is cancelled.",
              ]
            : []),
          "No charge is made.",
        ],
        label: "Extend trial",
      };
    if (a.kind === "pause")
      return paused
        ? {
            title: "Resume billing?",
            consequences: [
              "Renewals, dunning, trial expiry and the read-only purge apply again on their next run.",
              "Anything that came due while paused is picked up on that run.",
            ],
            label: "Resume billing",
          }
        : {
            title: "Pause billing?",
            consequences: [
              "No renewal charge, retry, past-due state or dunning email while paused.",
              "A trial does not expire and a read-only store is not deleted while paused.",
              "A store that is already read-only stays locked. Pre-expiry reminder emails still go out.",
            ],
            label: "Pause billing",
          };
    if (a.kind === "credit")
      return {
        title: `Credit ${formatMoney(creditCents, currency)}?`,
        consequences: [
          "Added to the wallet balance as a manual adjustment.",
          "The ledger row records you and the note.",
        ],
        label: "Give credit",
      };
    return {
      title: `Refund ${formatMoney(a.invoice.amount_cents, a.invoice.currency)}?`,
      consequences: [
        "The invoice is marked refunded.",
        "No money moves: return it to the merchant out of band (InstaPay).",
        "The subscription period is not changed.",
      ],
      label: "Mark refunded",
    };
  };

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    {
      key: "period_start",
      header: "Period",
      mono: true,
      render: (i) => `${formatDateTime(i.period_start)} → ${formatDateTime(i.period_end)}`,
    },
    {
      key: "amount_cents",
      header: "Amount",
      align: "end",
      mono: true,
      render: (i) => formatMoney(i.amount_cents, i.currency),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge status={INVOICE_STATUS[i.status] ?? "draft"} label={i.status} />,
    },
    { key: "paid_at", header: "Paid", mono: true, render: (i) => formatDateTime(i.paid_at) },
    {
      key: "actions",
      header: "",
      render: (i) =>
        i.status === "paid" ? (
          <Button
            size="sm"
            variant="danger-outline"
            onClick={() => setAction({ kind: "refund", invoice: i })}
          >
            Refund
          </Button>
        ) : null,
    },
  ];

  const current = action ? dialog(action) : null;

  return (
    <>
      <Card title="Billing controls" subtitle="Each action asks for a reason and is audited">
        <div className="ak-stack">
          <div className="ak-row-line">
            <span>
              Trial
              {billing?.expires_at ? ` · ends ${formatDateTime(billing.expires_at)}` : ""}
            </span>
            <span className="ak-cell-line">
              <Input
                aria-label="Days to extend"
                type="number"
                min={1}
                max={90}
                numeric
                affix="days"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!canExtend || !(dayCount >= 1 && dayCount <= 90)}
                onClick={() => setAction({ kind: "extend" })}
              >
                Extend trial
              </Button>
            </span>
          </div>
          <div className="ak-row-line">
            <span className="ak-cell-line">
              Billing
              <Badge tone={paused ? "warning" : "neutral"} square>
                {paused ? "Paused" : "Running"}
              </Badge>
            </span>
            <Button
              size="sm"
              variant="outline"
              icon={paused ? "playCircle" : "slash"}
              disabled={!billing}
              onClick={() => setAction({ kind: "pause" })}
            >
              {paused ? "Resume billing" : "Pause billing"}
            </Button>
          </div>
          <div className="ak-row-line">
            <span>Wallet credit</span>
            <span className="ak-cell-line">
              <Input
                aria-label="Credit amount"
                inputMode="decimal"
                numeric
                affix={currency}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!creditCents || creditCents <= 0}
                onClick={() => setAction({ kind: "credit" })}
              >
                Give credit
              </Button>
            </span>
          </div>
        </div>
      </Card>

      <Card title="Invoices" subtitle="Last 12 subscription invoices" flush>
        <DataTable
          columns={invoiceColumns}
          rows={insights?.invoices ?? []}
          rowKey={(i) => i.id}
          dense
          caption="Subscription invoices"
          empty={<EmptyState kind="empty" title="No invoices" />}
        />
      </Card>

      {action && current ? (
        <ConfirmDialog
          open
          tone={
            action.kind === "refund" || (action.kind === "pause" && !paused) ? "danger" : "warning"
          }
          title={current.title}
          entity={[
            { label: "Merchant", value: d.tenant?.name ?? d.store.name },
            { label: "Tenant ID", value: tenantId, mono: true },
            ...(action.kind === "refund"
              ? [{ label: "Invoice", value: action.invoice.id, mono: true }]
              : []),
          ]}
          consequences={current.consequences}
          confirmLabel={run.isPending ? "Working…" : current.label}
          onClose={() => setAction(null)}
          onConfirm={() => {
            if (run.isPending) return;
            if (reason.trim().length < 3) {
              toast.error(action.kind === "credit" ? "Add a note" : "Add a reason");
              return;
            }
            run.mutate(action);
          }}
        >
          <FormField
            label={action.kind === "credit" ? "Note" : "Reason"}
            hint="Saved in the audit log"
            required
          >
            <Textarea
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
