/**
 * Orders — the platform-wide order list.
 *
 * Support agents arrive here with an order number from a WhatsApp message,
 * so search is the first control and the order number is the first column.
 * Status changes are reversible and stay a one-step action; deletion is not
 * reversible and is gated behind a typed confirmation naming the order.
 * Clicking a row opens the order with the customer's history at that store.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  FilterBar,
  FormField,
  IconButton,
  KeyValue,
  MetricCard,
  NUMU_STATUS,
  Pagination,
  RiskScore,
  Select,
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatMoney, formatNumber, sentenceCase } from "@/lib/format";
import {
  deleteOrder,
  getOrder,
  getOrderStats,
  getOrders,
  updateOrderStatus,
  type Order,
} from "@/services/orderService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

type NumuStatus = keyof typeof NUMU_STATUS;

// Every order status the platform has, shown by its own name. The badge
// tone comes from the nearest shared status; the label is always the real one.
const ORDER_STATUS: Record<string, { tone: NumuStatus; label: string }> = {
  draft: { tone: "draft", label: "Draft" },
  awaiting_payment: { tone: "pending", label: "Awaiting payment" },
  pending_deposit: { tone: "pending", label: "Awaiting deposit" },
  pending: { tone: "pending", label: "Pending" },
  confirmed: { tone: "open", label: "Confirmed" },
  processing: { tone: "open", label: "Processing" },
  shipped: { tone: "shipped", label: "Shipped" },
  delivered: { tone: "delivered", label: "Delivered" },
  returned: { tone: "failed", label: "Returned" },
  cancelled: { tone: "cancelled", label: "Cancelled" },
  refunded: { tone: "refunded", label: "Refunded" },
  payment_failed: { tone: "failed", label: "Payment failed" },
};

const PAYMENT_STATUS: Record<string, { tone: NumuStatus; label: string }> = {
  paid: { tone: "paid", label: "Paid" },
  pending: { tone: "pending", label: "Unpaid" },
  partially_paid: { tone: "pending", label: "Partly paid" },
  failed: { tone: "failed", label: "Failed" },
  refunded: { tone: "refunded", label: "Refunded" },
  partially_refunded: { tone: "refunded", label: "Partly refunded" },
};

function statusOf(
  map: Record<string, { tone: NumuStatus; label: string }>,
  value: string | null | undefined,
) {
  const key = (value ?? "").toLowerCase();
  return (
    map[key] ?? {
      tone: "open" as NumuStatus,
      label: sentenceCase(key || "unknown"),
    }
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const s = statusOf(ORDER_STATUS, status);
  return <StatusBadge status={s.tone} label={s.label} />;
}

function PaymentBadge({ status }: { status: string }) {
  const s = statusOf(PAYMENT_STATUS, status);
  return <StatusBadge status={s.tone} label={s.label} />;
}

const VIEWS = [
  { id: "all", label: "All orders" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "returned", label: "Returned" },
  { id: "cancelled", label: "Cancelled" },
];

const NEXT_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const PAGE_SIZE = 20;

export default function Orders() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // The command palette links here with `?q=<order number>`, so the search
  // box starts from the URL rather than empty.
  const searchString = useSearch();
  const [search, setSearch] = useState(() => new URLSearchParams(searchString).get("q") ?? "");
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState("pending");
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const queryParams = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    status: view !== "all" ? view : undefined,
    search: search || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "list", queryParams],
    queryFn: () => getOrders(queryParams),
  });
  const { data: stats } = useQuery({
    queryKey: ["orders", "stats"],
    queryFn: getOrderStats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onSuccess: (_d, v) => {
      toast.success("Order status updated", {
        description: `${v.id.slice(0, 8)} · now ${v.status} · recorded in the audit log`,
      });
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Status change failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      toast.success("Order deleted", {
        description: "Recorded in the audit log",
      });
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Delete failed"),
  });

  const columns: DataTableColumn<Order>[] = [
    {
      key: "orderNumber",
      header: "Order",
      mono: true,
      render: (o) => o.orderNumber,
    },
    {
      key: "store",
      header: "Store",
      render: (o) => o.storeName ?? "—",
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div>
          <div className="ntb__primary">{o.customerName || "Guest"}</div>
          {o.customerPhone || o.customerEmail ? (
            <div className="ntb__sub numu-email" dir="ltr">
              {o.customerPhone || o.customerEmail}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <OrderStatusBadge status={o.status} />,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (o) => (
        <div>
          <PaymentBadge status={o.paymentStatus} />
          {o.paymentMethod ? <div className="ntb__sub">{sentenceCase(o.paymentMethod)}</div> : null}
        </div>
      ),
    },
    {
      key: "total",
      header: "Value",
      align: "end",
      mono: true,
      render: (o) => formatMoney(o.total, o.currency ?? "EGP"),
    },
    {
      key: "createdAt",
      header: "Placed",
      mono: true,
      render: (o) => formatDateTime(o.createdAt),
    },
    {
      key: "actions",
      header: "",
      width: 90,
      render: (o) => (
        <div className="ak-rowactions" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon="refresh"
            label="Change this order's status"
            size="sm"
            onClick={() => {
              setEditing(o);
              setNextStatus(o.status);
            }}
          />
          <IconButton
            icon="trash"
            label="Delete this order"
            size="sm"
            onClick={() => setDeleting(o)}
          />
        </div>
      ),
    },
  ];

  const orders = data?.orders ?? [];
  const filtered = Boolean(search) || view !== "all";

  return (
    <DashboardLayout
      title="Orders"
      subtitle="Every order across every merchant."
      meta={<span>{formatNumber(data?.total)} matching</span>}
    >
      <div className="ak-metrics">
        <MetricCard
          label="Pending"
          value={formatNumber(stats?.pending)}
          icon="clock"
          flat
          onClick={() => setView("pending")}
        />
        <MetricCard
          label="Confirmed"
          value={formatNumber(stats?.confirmed)}
          icon="check"
          flat
          onClick={() => setView("confirmed")}
        />
        <MetricCard
          label="Processing"
          value={formatNumber(stats?.processing)}
          icon="package"
          flat
          onClick={() => setView("processing")}
        />
        <MetricCard
          label="Shipped"
          value={formatNumber(stats?.shipped)}
          icon="truck"
          flat
          onClick={() => setView("shipped")}
        />
        <MetricCard
          label="Delivered"
          value={formatNumber(stats?.delivered)}
          icon="check"
          flat
          onClick={() => setView("delivered")}
        />
        <MetricCard
          label="Cancelled"
          value={formatNumber(stats?.cancelled)}
          icon="x"
          flat
          onClick={() => setView("cancelled")}
        />
      </div>

      <Card flush>
        <FilterBar
          savedViews={VIEWS}
          activeView={view}
          onViewChange={(id) => {
            setView(id);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Order number or customer"
          actions={
            <Button variant="subtle" size="sm" icon="refresh" onClick={invalidate}>
              Refresh
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(o) => o.orderId}
          loading={isLoading}
          caption="Orders across all merchants"
          onRowClick={(o) => setOpened(o.orderId)}
          isFlagged={(o) => o.paymentStatus === "failed" || o.status === "cancelled"}
          empty={
            <EmptyState
              kind={filtered ? "noResults" : "empty"}
              title={filtered ? "Nothing matches" : "No orders yet"}
              body={
                filtered
                  ? "Widen the search or switch to another saved view."
                  : "Orders placed on any merchant storefront appear here within seconds."
              }
              action={
                filtered ? (
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={() => {
                      setSearch("");
                      setView("all");
                    }}
                  >
                    Clear filters
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

      <Dialog
        open={Boolean(editing)}
        title="Change order status"
        description={
          editing
            ? `${editing.orderNumber} · ${formatMoney(editing.total, editing.currency ?? "EGP")} · currently ${statusOf(ORDER_STATUS, editing.status).label}.`
            : undefined
        }
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={statusMutation.isPending}
              onClick={() =>
                editing &&
                statusMutation.mutate({
                  id: editing.orderId,
                  status: nextStatus,
                })
              }
            >
              Update status
            </Button>
          </>
        }
      >
        <FormField
          label="New status"
          hint="The merchant sees the change immediately. This is recorded in the audit log against your account."
        >
          <Select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            options={NEXT_STATUS}
          />
        </FormField>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title="Delete this order?"
        entity={[
          { label: "Order", value: deleting?.orderNumber ?? "", mono: true },
          { label: "Customer", value: deleting?.customerName || "Guest" },
          {
            label: "Value",
            value: deleting ? formatMoney(deleting.total, deleting.currency ?? "EGP") : "",
            mono: true,
          },
        ]}
        consequences={[
          "The order disappears from the merchant's hub and from platform totals.",
          "Any payment already captured is not refunded by this action.",
          "This cannot be undone.",
        ]}
        confirmPhrase={deleting?.orderNumber}
        confirmLabel="Delete order"
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.orderId)}
      />

      {opened ? (
        <OrderDrawer
          orderId={opened}
          onClose={() => setOpened(null)}
          onOpenOrder={setOpened}
          onOpenMerchant={(storeId) => navigate(`/merchants/${storeId}`)}
        />
      ) : null}
    </DashboardLayout>
  );
}

function OrderDrawer({
  orderId,
  onClose,
  onOpenOrder,
  onOpenMerchant,
}: {
  orderId: string;
  onClose: () => void;
  onOpenOrder: (id: string) => void;
  onOpenMerchant: (storeId: string) => void;
}) {
  const q = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => getOrder(orderId),
  });
  const o = q.data;
  const money = (n: number | null | undefined) => formatMoney(n, o?.currency ?? "EGP");
  const address = o
    ? [
        o.shipping_address.address_line1,
        o.shipping_address.address_line2,
        o.shipping_address.city,
        o.shipping_address.state,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const history = o?.customer_history;
  const steps = o?.extra_data?.status_history ?? [];

  return (
    <Drawer
      open
      width={720}
      title={o ? `${o.order_number} · ${o.store_name ?? ""}` : "Order"}
      subtitle={o ? formatDateTime(o.created_at) : undefined}
      onClose={onClose}
      footer={
        o ? (
          <Button variant="subtle" icon="arrowRight" onClick={() => onOpenMerchant(o.store_id)}>
            Open merchant
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <EmptyState kind="empty" title="Loading order…" />
      ) : !o ? (
        <EmptyState
          kind="error"
          title="Order failed to load"
          body={q.error instanceof Error ? q.error.message : undefined}
        />
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <OrderStatusBadge status={o.status} />
            <PaymentBadge status={o.payment_status} />
            {o.risk_score != null ? <RiskScore score={o.risk_score} inline /> : null}
          </div>

          <KeyValue
            items={[
              { label: "Customer", value: o.customer_name || "Guest" },
              { label: "Phone", value: o.customer_phone || "—", mono: true },
              { label: "Email", value: o.customer_email || "—" },
              { label: "Ship to", value: address || "—" },
              {
                label: "Payment method",
                value: o.payment_method ? sentenceCase(o.payment_method) : "—",
              },
              { label: "Shipping", value: o.shipping_method || "—" },
              {
                label: "Tracking",
                value: o.tracking_number || "—",
                mono: true,
              },
              ...(o.cancelled_at
                ? [
                    {
                      label: "Cancelled",
                      value: `${formatDateTime(o.cancelled_at)}${o.extra_data?.cancellation_reason ? ` · ${o.extra_data.cancellation_reason}` : ""}`,
                    },
                  ]
                : []),
              ...(o.customer_notes ? [{ label: "Customer note", value: o.customer_notes }] : []),
            ]}
          />

          <Card title="Items">
            <DataTable
              dense
              columns={[
                {
                  key: "name",
                  header: "Product",
                  render: (li) => (
                    <div>
                      <div className="ntb__primary">{li.product_name ?? li.name ?? "—"}</div>
                      {li.variant_name ? <div className="ntb__sub">{li.variant_name}</div> : null}
                    </div>
                  ),
                },
                {
                  key: "qty",
                  header: "Qty",
                  align: "end",
                  mono: true,
                  render: (li) => li.quantity ?? 1,
                },
                {
                  key: "total",
                  header: "Total",
                  align: "end",
                  mono: true,
                  render: (li) =>
                    money(li.total_price ?? (li.unit_price ?? 0) * (li.quantity ?? 1)),
                },
              ]}
              rows={o.line_items}
              rowKey={(_li, i) => String(i)}
              caption="Items in this order"
            />
            <KeyValue
              items={[
                { label: "Subtotal", value: money(o.subtotal), mono: true },
                {
                  label: "Shipping",
                  value: money(o.shipping_cost),
                  mono: true,
                },
                ...(o.discount_amount
                  ? [
                      {
                        label: `Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`,
                        value: `-${money(o.discount_amount)}`,
                        mono: true,
                      },
                    ]
                  : []),
                { label: "Total", value: money(o.total), mono: true },
              ]}
            />
          </Card>

          {history ? (
            <Card title="Customer history at this store">
              <KeyValue
                items={[
                  {
                    label: "Orders",
                    value: formatNumber(history.orders),
                    mono: true,
                  },
                  {
                    label: "Delivered",
                    value: formatNumber(history.delivered),
                    mono: true,
                  },
                  {
                    label: "Returned",
                    value: formatNumber(history.returned),
                    mono: true,
                  },
                  {
                    label: "Cancelled",
                    value: formatNumber(history.cancelled),
                    mono: true,
                  },
                  {
                    label: "Paid in total",
                    value: money(history.paid_total),
                    mono: true,
                  },
                  {
                    label: "Customer since",
                    value: formatDateTime(history.first_order_at),
                  },
                ]}
              />
              <DataTable
                dense
                columns={[
                  {
                    key: "n",
                    header: "Order",
                    mono: true,
                    render: (h) => h.order_number,
                  },
                  {
                    key: "s",
                    header: "Status",
                    render: (h) => <OrderStatusBadge status={h.status} />,
                  },
                  {
                    key: "p",
                    header: "Payment",
                    render: (h) => <PaymentBadge status={h.payment_status} />,
                  },
                  {
                    key: "t",
                    header: "Total",
                    align: "end",
                    mono: true,
                    render: (h) => formatMoney(h.total, h.currency),
                  },
                  {
                    key: "d",
                    header: "Placed",
                    mono: true,
                    render: (h) => formatDateTime(h.created_at),
                  },
                ]}
                rows={history.recent}
                rowKey={(h) => h.id}
                caption="This customer's latest orders, newest first"
                isFlagged={(h) => h.id === o.id}
                onRowClick={(h) => h.id !== o.id && onOpenOrder(h.id)}
              />
            </Card>
          ) : null}

          {steps.length ? (
            <Card title="Status history">
              <DataTable
                dense
                columns={[
                  {
                    key: "c",
                    header: "Change",
                    render: (h) =>
                      `${statusOf(ORDER_STATUS, h.from).label} → ${statusOf(ORDER_STATUS, h.to).label}`,
                  },
                  { key: "r", header: "Reason", render: (h) => h.reason || "—" },
                  {
                    key: "w",
                    header: "When",
                    mono: true,
                    render: (h) => formatDateTime(h.timestamp),
                  },
                ]}
                rows={steps}
                rowKey={(h, i) => `${h.timestamp}:${i}`}
                caption="Every status change on this order"
              />
            </Card>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
