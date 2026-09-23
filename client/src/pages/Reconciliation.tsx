/**
 * Reconciliation Page - NUMU Admin Dashboard
 *
 * Features:
 * - Daily reconciliation run history with status filters
 * - KPI cards: total runs, clean runs, mismatches, total variance
 * - Expandable mismatch detail per run (gateway, order, transaction, resolve info)
 * - Mismatch type + resolved filters
 * - Manual trigger with date picker
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge as NumuBadge, MetricCard, StatusBadge } from "@/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminListReconciliationRuns,
  adminListReconciliationTransactions,
  adminListRunMismatches,
  adminReconcileMarkPaid,
  adminTriggerReconciliation,
  type AdminReconciliationRun,
  type AdminTransactionOrderRow,
  type MismatchType,
} from "@/services/adminApi";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Scale,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function RunStatusBadge({ run }: { run: AdminReconciliationRun }) {
  if (run.status === "failed") return <StatusBadge status="failed" />;
  if (run.status === "running") return <StatusBadge status="retrying" label="Running" />;
  if (run.mismatches_found === 0) return <StatusBadge status="healthy" label="Clean" />;
  return (
    <StatusBadge
      status="degraded"
      label={`${run.mismatches_found} mismatch${run.mismatches_found !== 1 ? "es" : ""}`}
    />
  );
}

// ── Mismatch type label ───────────────────────────────────────────────────────

/* Tone grades how bad the mismatch is, not what kind it is: a missing
   transaction is money the gateway never saw, an amount mismatch is money
   that does not add up, and a duplicate is a reconciliation artefact. */
const MISMATCH_LABELS: Record<
  MismatchType,
  { label: string; tone: "warning" | "danger" | "neutral" }
> = {
  amount_mismatch: { label: "Amount", tone: "warning" },
  missing_transaction: { label: "No transaction", tone: "danger" },
  missing_order: { label: "No order", tone: "danger" },
  duplicate_transaction: { label: "Duplicate", tone: "neutral" },
};

function MismatchTypeBadge({ type }: { type: string }) {
  const cfg = MISMATCH_LABELS[type as MismatchType];
  return (
    <NumuBadge tone={cfg?.tone ?? "neutral"} square>
      {cfg?.label ?? type}
    </NumuBadge>
  );
}

// ── Mismatch panel (lazy loaded per run) ──────────────────────────────────────

function MismatchPanel({
  runId,
  mismatchFilter,
  resolvedFilter,
}: {
  runId: string;
  mismatchFilter: string;
  resolvedFilter: string;
}) {
  const { data: mismatches = [], isLoading } = useQuery({
    queryKey: ["admin-reconciliation-mismatches", runId, mismatchFilter, resolvedFilter],
    queryFn: () =>
      adminListRunMismatches(runId, {
        mismatch_type: mismatchFilter !== "all" ? mismatchFilter : undefined,
        resolved:
          resolvedFilter === "open"
            ? false
            : resolvedFilter === "resolved"
              ? true
              : undefined,
        limit: 100,
      }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground px-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading mismatches…
      </div>
    );
  }

  if (mismatches.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No mismatches for this run{mismatchFilter !== "all" || resolvedFilter !== "all" ? " (with current filters)" : ""}.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Order #</TableHead>
            <TableHead className="text-xs">Order ID</TableHead>
            <TableHead className="text-xs">Gateway</TableHead>
            <TableHead className="text-xs">Txn ID</TableHead>
            <TableHead className="text-xs text-right">Expected</TableHead>
            <TableHead className="text-xs text-right">Actual</TableHead>
            <TableHead className="text-xs text-right">Variance</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Resolved By</TableHead>
            <TableHead className="text-xs">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mismatches.map((m) => {
            const variance =
              m.expected_amount_cents != null && m.actual_amount_cents != null
                ? m.expected_amount_cents - m.actual_amount_cents
                : null;
            return (
              <TableRow key={m.id} className="text-xs">
                <TableCell>
                  <MismatchTypeBadge type={m.mismatch_type} />
                </TableCell>
                <TableCell className="font-mono">{m.order_number ?? "—"}</TableCell>
                <TableCell className="font-mono text-muted-foreground max-w-[100px] truncate">
                  {m.order_id ? m.order_id.substring(0, 8) + "…" : "—"}
                </TableCell>
                <TableCell className="capitalize">{m.gateway ?? "—"}</TableCell>
                <TableCell className="font-mono max-w-[120px] truncate">
                  {m.gateway_transaction_id ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.expected_amount_cents != null ? formatCents(m.expected_amount_cents) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.actual_amount_cents != null
                    ? formatCents(m.actual_amount_cents)
                    : m.gateway?.toLowerCase() === "cod"
                      ? "Cash"
                      : "—"}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-medium ${
                    variance != null && variance !== 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {variance != null
                    ? variance === 0
                      ? "—"
                      : `${variance > 0 ? "+" : "-"}${formatCents(variance)}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={m.resolved ? "resolved" : "open"} />
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[120px]">
                  {m.resolved_by ? (
                    <div>
                      <p className="truncate">{m.resolved_by}</p>
                      {m.resolved_at && (
                        <p className="text-[10px]">{formatDateTime(m.resolved_at)}</p>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[160px] truncate">
                  {m.notes ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Expandable run row ────────────────────────────────────────────────────────

function RunRow({
  run,
  mismatchFilter,
  resolvedFilter,
}: {
  run: AdminReconciliationRun;
  mismatchFilter: string;
  resolvedFilter: string;
}) {
  const [open, setOpen] = useState(false);
  const variance = run.expected_amount_cents - run.actual_amount_cents;

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/30 transition-colors ${
          run.mismatches_found > 0 ? "border-l-2 border-l-amber-400" : ""
        } ${run.status === "failed" ? "border-l-2 border-l-red-400" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell className="w-8 pr-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="text-sm font-medium">{formatDate(run.period_start)}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(run.period_end)}
        </TableCell>
        <TableCell>
          <NumuBadge tone="info" square>
            {run.gateway}
          </NumuBadge>
        </TableCell>
        <TableCell>
          <RunStatusBadge run={run} />
        </TableCell>
        <TableCell className="text-sm text-right tabular-nums">
          {run.total_orders_checked.toLocaleString()}
        </TableCell>
        <TableCell className="text-sm text-right tabular-nums">
          {run.total_transactions_checked.toLocaleString()}
        </TableCell>
        <TableCell className="text-sm text-right tabular-nums">
          {formatCents(run.expected_amount_cents)}
        </TableCell>
        <TableCell className="text-sm text-right tabular-nums">
          {formatCents(run.actual_amount_cents)}
        </TableCell>
        <TableCell
          className={`text-sm text-right tabular-nums font-semibold ${
            variance !== 0 ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {variance === 0
            ? "—"
            : `${variance > 0 ? "+" : "-"}${formatCents(variance)}`}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {run.completed_at ? formatDateTime(run.completed_at) : "—"}
        </TableCell>
        {run.error_message && (
          <TableCell
            className="text-xs text-red-600 max-w-[180px] truncate"
            title={run.error_message}
          >
            {run.error_message}
          </TableCell>
        )}
      </TableRow>

      {open && (
        <TableRow>
          <TableCell colSpan={11} className="p-0 bg-muted/10 border-b">
            <div className="px-6 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Mismatches — {formatDate(run.period_start)} · {run.gateway}
              </p>
              <MismatchPanel
                runId={run.id}
                mismatchFilter={mismatchFilter}
                resolvedFilter={resolvedFilter}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Live transactions (gateway payment ↔ order state) ─────────────────────────

const GATEWAYS = ["kashier", "paymob", "moyasar", "fawaterak", "instapay"];

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function TransactionsPanel() {
  const queryClient = useQueryClient();
  const [gateway, setGateway] = useState("all");
  const [mismatchOnly, setMismatchOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<AdminTransactionOrderRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reconciliation-transactions", gateway, mismatchOnly, page],
    queryFn: () =>
      adminListReconciliationTransactions({
        gateway: gateway !== "all" ? gateway : undefined,
        mismatch_only: mismatchOnly,
        page,
        limit: 50,
      }),
  });

  const markPaid = useMutation({
    mutationFn: (txId: string) => adminReconcileMarkPaid(txId),
    onSuccess: (row) => {
      toast.success(`${row.order_number} marked paid`);
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ["admin-reconciliation-transactions"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to mark paid"),
  });

  const rows = data?.items ?? [];

  return (
    <div className="dashboard-card mb-6">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Gateway transactions</h2>
          <p className="text-xs text-muted-foreground">
            Live, last 30 days. A paid transaction on an unpaid order means the webhook did not land.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={gateway} onValueChange={(v) => { setGateway(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Gateway" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gateways</SelectItem>
              {GATEWAYS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={mismatchOnly ? "mismatch" : "all"}
            onValueChange={(v) => { setMismatchOnly(v === "mismatch"); setPage(1); }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mismatch">Mismatches only</SelectItem>
              <SelectItem value="all">All transactions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {mismatchOnly ? "No mismatches. Every paid transaction has a paid order." : "No transactions."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Order state</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.transaction_id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.store_name ?? r.store_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{r.gateway}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.gateway_transaction_id ?? "—"}
                    <span className="block text-muted-foreground">{r.tx_status}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">
                    {formatMoney(r.amount_cents, r.currency)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.order_number ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.order_status ? `${r.order_status} / ${r.payment_status}` : "—"}
                  </TableCell>
                  <TableCell>
                    {r.mismatch === "paid_not_recorded" && (
                      <NumuBadge tone="danger" square>Paid, not recorded</NumuBadge>
                    )}
                    {r.mismatch === "order_missing" && (
                      <NumuBadge tone="warning" square>No order</NumuBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.mismatch === "paid_not_recorded" && (
                      <Button size="sm" variant="outline" onClick={() => setConfirming(r)}>
                        Mark paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {data.page} of {data.total_pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.total_pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {confirming?.order_number} paid?</DialogTitle>
            <DialogDescription>
              Applies {confirming?.gateway} transaction {confirming?.gateway_transaction_id} (
              {confirming && formatMoney(confirming.amount_cents, confirming.currency)}) to the order,
              as if the webhook had landed. The merchant gets the new-order notifications and the
              shipment is booked if auto-shipping is on. Logged to the audit trail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirming && markPaid.mutate(confirming.transaction_id)}
              disabled={markPaid.isPending}
              className="gap-2"
            >
              {markPaid.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Reconciliation() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [mismatchFilter, setMismatchFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggerDate, setTriggerDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // default: yesterday
    return d.toISOString().split("T")[0];
  });

  // ── Data ──
  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-reconciliation-runs", statusFilter],
    queryFn: () =>
      adminListReconciliationRuns({
        limit: 60,
        status: statusFilter !== "all" ? (statusFilter as any) : undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  // ── Trigger mutation ──
  const triggerMutation = useMutation({
    mutationFn: () => adminTriggerReconciliation(triggerDate),
    onSuccess: (data) => {
      toast.success(data.message);
      setTriggerDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-reconciliation-runs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to trigger reconciliation");
    },
  });

  // ── KPIs ──
  const totalRuns = runs.length;
  const cleanRuns = runs.filter((r) => r.status === "completed" && r.mismatches_found === 0).length;
  const runsWithMismatches = runs.filter((r) => r.mismatches_found > 0).length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const totalVariance = runs.reduce(
    (acc, r) => acc + Math.abs(r.expected_amount_cents - r.actual_amount_cents),
    0
  );
  const totalMismatches = runs.reduce((acc, r) => acc + r.mismatches_found, 0);

  return (
    <DashboardLayout
      title="Payment reconciliation"
      subtitle="Paid orders against gateway transactions, run daily."
    >
      <div className="ak-metrics">
        <MetricCard
          label="Runs"
          value={totalRuns}
          note={`${cleanRuns} clean`}
          icon="activity"
          flat
        />
        <MetricCard
          label="Clean runs"
          value={cleanRuns}
          note="zero mismatches"
          icon="check"
          flat
        />
        <MetricCard
          label="Mismatches"
          value={totalMismatches}
          note={`across ${runsWithMismatches} run${runsWithMismatches !== 1 ? "s" : ""}`}
          icon="alertTriangle"
          alert={totalMismatches > 0}
          flat
        />
        <MetricCard
          label="Failed runs"
          value={failedRuns}
          note={failedRuns > 0 ? "needs an operator" : "all passed"}
          icon="x"
          alert={failedRuns > 0}
          flat
        />
        <MetricCard
          label="Total variance"
          value={formatCents(totalVariance)}
          note="absolute, all runs"
          icon="trendingDown"
          alert={totalVariance > 0}
          flat
        />
      </div>

      <TransactionsPanel />

      {/* Controls */}
      <div className="dashboard-card mb-6">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Run status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Mismatch type filter (applies inside expanded rows) */}
            <Select value={mismatchFilter} onValueChange={(v) => setMismatchFilter(v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Mismatch type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mismatch Types</SelectItem>
                <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
                <SelectItem value="missing_transaction">Missing Transaction</SelectItem>
                <SelectItem value="missing_order">Missing Order</SelectItem>
                <SelectItem value="duplicate_transaction">Duplicate</SelectItem>
              </SelectContent>
            </Select>

            {/* Resolved filter */}
            <Select value={resolvedFilter} onValueChange={(v) => setResolvedFilter(v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Resolved" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setTriggerDialogOpen(true)}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Trigger Run
            </Button>
          </div>
        </div>
      </div>

      {/* Run table */}
      <div className="dashboard-card">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Reconciliation Runs</h2>
          {runsWithMismatches > 0 && (
            <Badge className="bg-amber-100 text-amber-700 ml-auto gap-1">
              <AlertTriangle className="h-3 w-3" />
              {runsWithMismatches} run{runsWithMismatches !== 1 ? "s" : ""} with mismatches
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading runs…
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm">No reconciliation runs found.</p>
            <p className="text-xs">Runs are scheduled daily at 2 AM UTC or can be triggered manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Period Start</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    mismatchFilter={mismatchFilter}
                    resolvedFilter={resolvedFilter}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-4 pt-4 border-t">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            Clean — zero mismatches
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-0.5 w-2 rounded-full bg-amber-500" />
            Amber border — has mismatches
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            Red border — run failed
          </div>
          <span className="ml-auto">Click any row to expand mismatches</span>
        </div>
      </div>

      {/* Trigger dialog */}
      <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger Reconciliation</DialogTitle>
            <DialogDescription>
              Manually run reconciliation for a specific date. This compares PAID orders
              against payment gateway transactions and records any mismatches.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium">Target Date</label>
            <Input
              type="date"
              value={triggerDate}
              onChange={(e) => setTriggerDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to yesterday. Runs synchronously — may take 10–30 seconds.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending || !triggerDate}
              className="gap-2"
            >
              {triggerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
