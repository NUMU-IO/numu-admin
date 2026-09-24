/**
 * App billing (paid apps v2): every store's app subscription, app revenue by
 * month (gross, the partners' 80%, NUMU's share), and recent app charges
 * with a full refund. A refund credits the merchant's wallet and reverses
 * the partner's share in one step; it needs the 2FA step-up and is audited.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Input,
  MetricCard,
  Select,
  Tabs,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  getAppRevenue,
  listAppCharges,
  listAppSubscriptions,
  refundAppCharge,
  type AdminAppSubscription,
  type AppCharge,
  type AppSubStatus,
  type RevenueMonth,
} from "@/services/appsAdminApi";
import { is2FAError } from "@/services/platformCapabilitiesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type Tab = "subscriptions" | "revenue" | "charges";

const STATUS_TONE: Record<AppSubStatus, "success" | "info" | "warning" | "neutral"> = {
  active: "success",
  trial: "info",
  past_due: "warning",
  cancelled: "neutral",
};

function onError(err: unknown) {
  if (is2FAError(err)) {
    toast.error("2FA step-up required", { description: "Verify your second factor again, then retry." });
    return;
  }
  toast.error(err instanceof Error ? err.message : String(err));
}

/** Refund one app charge in full, after a confirmation with a reason. */
export function RefundChargeDialog({
  charge,
  onClose,
  onDone,
}: {
  charge: { id: string; amount_cents: number; label: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("Refunded by NUMU");
  const refund = useMutation({
    mutationFn: () => refundAppCharge(charge.id, note.trim()),
    onSuccess: (res) => {
      if (res.refunded) {
        toast.success(`Refunded ${formatMoney(res.amount_cents ?? charge.amount_cents)}`, {
          description:
            res.partner_adjustment_cents
              ? `Partner share reversed: ${formatMoney(res.partner_adjustment_cents)}`
              : "No partner share to reverse (a NUMU App).",
        });
      } else {
        toast.info("This charge was already refunded");
      }
      onDone();
    },
    onError,
  });
  return (
    <ConfirmDialog
      tone="warning"
      title="Refund this app charge?"
      entity={[
        { label: "Charge", value: charge.label },
        { label: "Amount", value: formatMoney(charge.amount_cents), mono: true },
      ]}
      consequences={[
        "The full amount goes back to the merchant's NUMU wallet.",
        "The partner's 80% of it is taken back from what NUMU owes them.",
        "A charge is refunded once; a second refund does nothing.",
      ]}
      confirmLabel="Refund"
      onClose={onClose}
      onConfirm={() => {
        if (note.trim().length < 3) {
          toast.error("Write a reason of at least 3 characters.");
          return;
        }
        refund.mutate();
        onClose();
      }}
    >
      <FormField label="Reason" required htmlFor="refund-note">
        <Textarea id="refund-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
    </ConfirmDialog>
  );
}

const SUB_COLUMNS: DataTableColumn<AdminAppSubscription>[] = [
  { key: "app_name", header: "App", render: (s) => s.app_name },
  { key: "store_name", header: "Store", render: (s) => s.store_name ?? s.store_id },
  {
    key: "status",
    header: "Status",
    render: (s) => (
      <Badge tone={STATUS_TONE[s.status]} square>
        {s.status.replace("_", " ")}
        {s.cancel_at_period_end ? " · ends" : ""}
      </Badge>
    ),
  },
  {
    key: "price_cents",
    header: "Price",
    align: "end",
    mono: true,
    render: (s) => `${formatMoney(s.price_cents, s.currency)} / ${s.cycle === "annual" ? "yr" : "mo"}`,
  },
  {
    key: "usage_cap_cents",
    header: "Usage cap",
    align: "end",
    mono: true,
    render: (s) => (s.usage_cap_cents != null ? formatMoney(s.usage_cap_cents, s.currency) : "—"),
  },
  { key: "current_period_end", header: "Period ends", mono: true, render: (s) => formatDateTime(s.current_period_end) },
];

const REVENUE_COLUMNS: DataTableColumn<RevenueMonth>[] = [
  { key: "month", header: "Month", mono: true },
  { key: "gross_cents", header: "Gross", align: "end", mono: true, render: (r) => formatMoney(r.gross_cents) },
  { key: "vat_cents", header: "VAT (NUMU fee)", align: "end", mono: true, render: (r) => formatMoney(r.vat_cents) },
  { key: "partner_cents", header: "Partners", align: "end", mono: true, render: (r) => formatMoney(r.partner_cents) },
  { key: "numu_cents", header: "NUMU (ex VAT)", align: "end", mono: true, render: (r) => formatMoney(r.numu_cents) },
];

function Subscriptions() {
  const [status, setStatus] = useState<AppSubStatus | "">("");
  const [app, setApp] = useState("");
  const [storeId, setStoreId] = useState("");
  const q = useQuery({
    queryKey: ["app-billing", "subscriptions", status, app, storeId],
    queryFn: () =>
      listAppSubscriptions({ status: status || undefined, app: app.trim(), store_id: storeId.trim() }),
  });
  return (
    <Card>
      <div className="ak-2col">
        <FormField label="Status" htmlFor="sub-status">
          <Select
            id="sub-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AppSubStatus | "")}
            options={[
              { value: "", label: "All" },
              { value: "active", label: "Active" },
              { value: "trial", label: "Trial" },
              { value: "past_due", label: "Past due" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </FormField>
        <FormField label="App slug" htmlFor="sub-app">
          <Input id="sub-app" mono value={app} onChange={(e) => setApp(e.target.value)} />
        </FormField>
        <FormField label="Store ID" htmlFor="sub-store">
          <Input id="sub-store" mono value={storeId} onChange={(e) => setStoreId(e.target.value)} />
        </FormField>
      </div>
      <DataTable
        dense
        caption="App subscriptions, newest first"
        columns={SUB_COLUMNS}
        rows={q.data ?? []}
        rowKey={(s) => s.id}
        loading={q.isLoading}
        empty={<EmptyState kind="empty" icon="inbox" title="No subscriptions" body="None match these filters." />}
      />
      {q.isError ? <p className="text-sm text-destructive">{String(q.error)}</p> : null}
    </Card>
  );
}

function Revenue() {
  const q = useQuery({ queryKey: ["app-billing", "revenue"], queryFn: () => getAppRevenue(12) });
  const t = q.data?.totals;
  return (
    <>
      <div className="ak-2col">
        <MetricCard label="Gross (12 months)" value={formatMoney(t?.gross_cents)} note={`Paid by merchants, net of refunds, incl. ${formatMoney(t?.vat_cents)} VAT`} icon="banknote" loading={q.isLoading} />
        <MetricCard label="Partners' share" value={formatMoney(t?.partner_cents)} note="Partner App sales, net of refunds and coupons" icon="plug" loading={q.isLoading} />
        <MetricCard label="NUMU" value={formatMoney(t?.numu_cents)} note="Fees on Partner Apps and all of NUMU Apps, before VAT" icon="package" loading={q.isLoading} />
      </div>
      <DataTable
        dense
        caption="App revenue by month (UTC)"
        columns={REVENUE_COLUMNS}
        rows={q.data?.months ?? []}
        rowKey={(r) => r.month}
        loading={q.isLoading}
        empty={<EmptyState kind="empty" icon="inbox" title="No app revenue yet" body="Paid-app charges show up here." />}
      />
    </>
  );
}

function Charges() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["app-billing", "charges"], queryFn: listAppCharges });
  const [refunding, setRefunding] = useState<AppCharge | null>(null);
  const columns: DataTableColumn<AppCharge>[] = [
    { key: "created_at", header: "When", mono: true, render: (c) => formatDateTime(c.created_at) },
    { key: "note", header: "Charge", render: (c) => c.note ?? "—" },
    { key: "tenant_id", header: "Tenant", mono: true },
    { key: "amount_cents", header: "Amount", align: "end", mono: true, render: (c) => formatMoney(c.amount_cents, c.currency) },
    {
      key: "refunded",
      header: "",
      align: "end",
      render: (c) =>
        c.refunded ? (
          <Badge tone="neutral" square>
            Refunded
          </Badge>
        ) : (
          <Button size="sm" variant="subtle" onClick={() => setRefunding(c)}>
            Refund…
          </Button>
        ),
    },
  ];
  return (
    <>
      <DataTable
        dense
        caption="Recent app charges from merchants' wallets"
        columns={columns}
        rows={q.data ?? []}
        rowKey={(c) => c.id}
        loading={q.isLoading}
        empty={<EmptyState kind="empty" icon="inbox" title="No app charges yet" body="Charges appear when a merchant pays for an app." />}
      />
      {refunding ? (
        <RefundChargeDialog
          charge={{ id: refunding.id, amount_cents: refunding.amount_cents, label: refunding.note ?? refunding.id }}
          onClose={() => setRefunding(null)}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ["app-billing"] })}
        />
      ) : null}
    </>
  );
}

export default function AppBilling() {
  const [tab, setTab] = useState<Tab>("subscriptions");
  return (
    <DashboardLayout
      title="App billing"
      subtitle="Paid-app subscriptions, revenue and refunds."
      tabs={
        <Tabs
          tabs={[
            { id: "subscriptions", label: "Subscriptions" },
            { id: "revenue", label: "Revenue" },
            { id: "charges", label: "Charges" },
          ]}
          active={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      }
    >
      {tab === "subscriptions" ? <Subscriptions /> : tab === "revenue" ? <Revenue /> : <Charges />}
    </DashboardLayout>
  );
}
