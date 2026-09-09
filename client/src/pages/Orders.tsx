/**
 * Orders — the platform-wide order list.
 *
 * Support agents arrive here with an order number from a WhatsApp message,
 * so search is the first control and the order number is the first column.
 * Status changes are reversible and stay a one-step action; deletion is not
 * reversible and is gated behind a typed confirmation naming the order.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  FormField,
  IconButton,
  MetricCard,
  NUMU_STATUS,
  Pagination,
  Select,
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  deleteOrder,
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

const ORDER_STATUS: Record<string, NumuStatus> = {
  pending: "pending",
  processing: "in_review",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
  payment_failed: "failed",
};

const PAYMENT_STATUS: Record<string, NumuStatus> = {
  paid: "paid",
  pending: "pending",
  failed: "failed",
  refunded: "refunded",
};

const VIEWS = [
  { id: "all", label: "All orders" },
  { id: "pending", label: "Pending" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const NEXT_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
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
  const [search, setSearch] = useState(
    () => new URLSearchParams(searchString).get("q") ?? "",
  );
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState("pending");
  const [deleting, setDeleting] = useState<Order | null>(null);

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
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateOrderStatus(id, status),
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
      toast.success("Order deleted", { description: "Recorded in the audit log" });
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Delete failed"),
  });

  const columns: DataTableColumn<Order>[] = [
    { key: "orderId", header: "Order", mono: true, render: (o) => o.orderId.slice(0, 8) },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div>
          <div className="ntb__primary">{o.customerName || "Guest"}</div>
          {o.customerEmail ? (
            <div className="ntb__sub numu-email">{o.customerEmail}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusBadge status={ORDER_STATUS[o.status] ?? "open"} />,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (o) => (
        <StatusBadge status={PAYMENT_STATUS[o.paymentStatus] ?? "pending"} />
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
          onRowClick={(o) => navigate(`/merchants/${o.merchantId}`)}
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
            ? `${editing.orderId.slice(0, 8)} · ${formatMoney(editing.total, editing.currency ?? "EGP")} · currently ${editing.status}.`
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
                statusMutation.mutate({ id: editing.orderId, status: nextStatus })
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
          { label: "Order", value: deleting?.orderId ?? "", mono: true },
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
        confirmPhrase={deleting?.orderId.slice(0, 8)}
        confirmLabel="Delete order"
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.orderId)}
      />
    </DashboardLayout>
  );
}
