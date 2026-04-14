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
  adminListRunMismatches,
  adminTriggerReconciliation,
  type AdminReconciliationRun,
  type MismatchType,
} from "@/services/adminApi";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Scale,
  TrendingDown,
  XCircle,
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
  if (run.status === "failed") {
    return (
      <Badge className="bg-red-100 text-red-700 gap-1 w-fit">
        <XCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  }
  if (run.status === "running") {
    return (
      <Badge className="bg-blue-100 text-blue-700 gap-1 w-fit">
        <Activity className="h-3 w-3" /> Running
      </Badge>
    );
  }
  if (run.mismatches_found === 0) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 gap-1 w-fit">
        <CheckCircle2 className="h-3 w-3" /> Clean
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 gap-1 w-fit">
      <AlertTriangle className="h-3 w-3" />
      {run.mismatches_found} mismatch{run.mismatches_found !== 1 ? "es" : ""}
    </Badge>
  );
}

// ── Mismatch type label ───────────────────────────────────────────────────────

const MISMATCH_LABELS: Record<MismatchType, { label: string; color: string }> = {
  amount_mismatch: { label: "Amount Mismatch", color: "bg-amber-100 text-amber-700" },
  missing_transaction: { label: "Missing Transaction", color: "bg-red-100 text-red-700" },
  missing_order: { label: "Missing Order", color: "bg-orange-100 text-orange-700" },
  duplicate_transaction: { label: "Duplicate", color: "bg-purple-100 text-purple-700" },
};

function MismatchTypeBadge({ type }: { type: string }) {
  const cfg = MISMATCH_LABELS[type as MismatchType];
  return (
    <Badge className={`text-xs w-fit ${cfg?.color ?? "bg-gray-100 text-gray-700"}`}>
      {cfg?.label ?? type}
    </Badge>
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
                  {m.resolved ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                      Resolved
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">Open</Badge>
                  )}
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
          <Badge className="bg-blue-50 text-blue-700 text-xs capitalize">{run.gateway}</Badge>
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

  const kpis = [
    {
      label: "Total Runs",
      value: totalRuns,
      sub: `${cleanRuns} clean`,
      icon: Activity,
      color: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Clean Runs",
      value: cleanRuns,
      sub: "Zero mismatches",
      icon: CheckCircle2,
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Total Mismatches",
      value: totalMismatches,
      sub: `across ${runsWithMismatches} run${runsWithMismatches !== 1 ? "s" : ""}`,
      icon: AlertTriangle,
      color: runsWithMismatches > 0 ? "bg-amber-50" : "bg-gray-50",
      iconColor: runsWithMismatches > 0 ? "text-amber-600" : "text-muted-foreground",
    },
    {
      label: "Failed Runs",
      value: failedRuns,
      sub: failedRuns > 0 ? "Needs attention" : "All passed",
      icon: XCircle,
      color: failedRuns > 0 ? "bg-red-50" : "bg-gray-50",
      iconColor: failedRuns > 0 ? "text-red-600" : "text-muted-foreground",
    },
    {
      label: "Total Variance",
      value: formatCents(totalVariance),
      sub: "Abs. sum all runs",
      icon: TrendingDown,
      color: totalVariance > 0 ? "bg-red-50" : "bg-emerald-50",
      iconColor: totalVariance > 0 ? "text-red-600" : "text-emerald-600",
    },
  ];

  return (
    <DashboardLayout
      title="Payment Reconciliation"
      subtitle="Daily comparison of PAID orders vs payment gateway transactions"
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="dashboard-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
              <p className="text-xl font-bold truncate">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground truncate">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

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
