/**
 * Trust & risk — the COD review queue.
 *
 * Cash on delivery is where the platform carries the loss, so this is the
 * screen where a human agrees or disagrees with the score. Three rules from
 * the design system shape it:
 *
 *   - the queue is newest-first and never by score. Sorting by score looks
 *     decisive and starves everything below the top band; sorting oldest-first
 *     put four-month-old assessments at the top of every page, so the order
 *     that came in this morning — the one a decision can still change — was
 *     never on screen. Oldest is still one click away;
 *   - a score is never shown alone — the signals behind it sit next to it,
 *     because a bare number is not something anyone can disagree with;
 *   - the decision buttons stay disabled until a reason is written.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  FormField,
  KeyValue,
  Pagination,
  RiskScore,
  Select,
  StatusBadge,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import {
  decideRisk,
  listRisk,
  type RiskDecision,
  type RiskItem,
  type RiskSort,
  type RiskLevelFilter,
  type RiskStateFilter,
} from "@/services/riskApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PAGE_SIZE = 25;

const VIEWS: { id: RiskLevelFilter; label: string }[] = [
  { id: "all", label: "All levels" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

/** Signal codes are stored machine-readable; operators read sentences. */
const FACTOR_COPY: Record<string, string> = {
  orders_to_phone_24h: "Multiple orders to this phone in 24 hours",
  first_order_on_store: "First order this customer has placed on this store",
  address_unresolved: "Delivery address does not resolve to a known location",
  velocity: "Order velocity above this store's normal rate",
  prior_rto: "This customer has refused a delivery before",
};

export default function TrustRisk() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [level, setLevel] = useState<RiskLevelFilter>("all");
  const [state, setState] = useState<RiskStateFilter>("open");
  // Newest first. Never by score — that starves everything below the top
  // band — but oldest is one click away for a backlog sweep.
  const [sort, setSort] = useState<RiskSort>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [reviewing, setReviewing] = useState<RiskItem | null>(null);
  const [reason, setReason] = useState("");

  const params = {
    level,
    state,
    search: search || undefined,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["risk", "list", params],
    queryFn: () => listRisk(params),
    refetchInterval: 60_000,
  });

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: RiskDecision; reason: string }) =>
      decideRisk(vars.id, vars.decision, vars.reason),
    onSuccess: (_d, vars) => {
      toast.success(`Order ${vars.decision}ed`, {
        description: "Recorded against your account in the audit log",
      });
      setReviewing(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["risk"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error((e as Error).message || "The decision was not recorded"),
  });

  const columns: DataTableColumn<RiskItem>[] = [
    {
      key: "created_at",
      header: "Waiting",
      mono: true,
      render: (r) => formatRelative(r.created_at),
    },
    {
      key: "order_number",
      header: "Order",
      mono: true,
      render: (r) => r.order_number ?? "—",
    },
    {
      key: "store_name",
      header: "Store",
      render: (r) => r.store_name ?? "—",
    },
    {
      key: "customer_name",
      header: "Customer",
      render: (r) => (
        <div>
          <div>{r.customer_name || "Guest"}</div>
          {r.customer_email ? (
            <div className="ntb__sub numu-email">{r.customer_email}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "payment_method",
      header: "Method",
      render: (r) => (
        <Badge tone="neutral" square>
          {(r.payment_method || "—").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "risk_score",
      header: "Risk",
      render: (r) => <RiskScore score={r.risk_score} inline />,
    },
    {
      key: "total_cents",
      header: "Value",
      align: "end",
      mono: true,
      render: (r) => formatMoney(r.total_cents ?? 0, r.currency ?? "EGP"),
    },
    {
      key: "action_taken",
      header: "Decision",
      render: (r) =>
        r.action_taken ? (
          <StatusBadge
            status={r.action_taken === "reject" ? "failed" : "resolved"}
            label={r.action_taken}
          />
        ) : (
          <StatusBadge status="in_review" label="Awaiting" />
        ),
    },
  ];

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const canDecide = reason.trim().length >= 3;

  return (
    <DashboardLayout
      title="Trust & risk"
      subtitle="Scored cash-on-delivery orders. A decision needs a reason."
      meta={
        <>
          <span>{formatNumber(counts.open)} awaiting review</span>
          <span>{formatNumber(counts.critical)} critical</span>
          <span>{formatNumber(counts.high)} high</span>
        </>
      }
    >
      <Card flush>
        <FilterBar
          savedViews={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
          activeView={level}
          onViewChange={(id) => {
            setLevel(id as RiskLevelFilter);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Order, customer or store"
          actions={
            <>
              {(["open", "decided", "all"] as RiskStateFilter[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={state === s ? "primary" : "subtle"}
                  onClick={() => {
                    setState(s);
                    setPage(1);
                  }}
                >
                  {s === "open" ? "Awaiting" : s === "decided" ? "Decided" : "All"}
                </Button>
              ))}
              <Select
                aria-label="Sort order"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as RiskSort);
                  setPage(1);
                }}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Longest waiting" },
                ]}
              />
            </>
          }
        />
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          dense
          loading={isLoading}
          caption="Scored orders awaiting a trust decision"
          onRowClick={(r) => {
            setReviewing(r);
            setReason("");
          }}
          isFlagged={(r) => r.risk_score >= 80 && !r.action_taken}
          empty={
            <EmptyState
              kind={search || level !== "all" ? "noResults" : "empty"}
              icon="shield"
              title={state === "open" ? "Queue is clear" : "Nothing matches"}
              body={
                state === "open"
                  ? "No scored order is waiting on a reviewer."
                  : "Widen the filters or switch back to the awaiting view."
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

      <Drawer
        open={Boolean(reviewing)}
        title={reviewing?.order_number ?? "Review order"}
        onClose={() => setReviewing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button
              variant="subtle"
              icon="shieldAlert"
              disabled={!canDecide || decide.isPending}
              onClick={() =>
                reviewing &&
                decide.mutate({ id: reviewing.id, decision: "escalate", reason })
              }
            >
              Escalate
            </Button>
            <Button
              variant="danger-outline"
              icon="x"
              disabled={!canDecide || decide.isPending}
              onClick={() =>
                reviewing &&
                decide.mutate({ id: reviewing.id, decision: "reject", reason })
              }
            >
              Hold order
            </Button>
            <Button
              icon="check"
              loading={decide.isPending}
              disabled={!canDecide}
              onClick={() =>
                reviewing &&
                decide.mutate({ id: reviewing.id, decision: "accept", reason })
              }
            >
              Release
            </Button>
          </>
        }
      >
        {reviewing ? (
          <div className="ak-stack">
            <RiskScore
              score={reviewing.risk_score}
              reasons={(reviewing.factors ?? [])
                .filter((f) => f.weight > 0)
                .map((f) => FACTOR_COPY[f.code] ?? f.code)}
            />

            <KeyValue
              items={[
                { label: "Store", value: reviewing.store_name ?? "—" },
                { label: "Order", value: reviewing.order_number ?? "—", mono: true },
                { label: "Customer", value: reviewing.customer_name ?? "Guest" },
                { label: "Email", value: reviewing.customer_email ?? "—", mono: true },
                {
                  label: "Value",
                  value: formatMoney(reviewing.total_cents ?? 0, reviewing.currency ?? "EGP"),
                  mono: true,
                },
                { label: "Method", value: (reviewing.payment_method ?? "—").toUpperCase() },
                { label: "Scored", value: formatDateTime(reviewing.created_at), mono: true },
                { label: "Model suggests", value: reviewing.suggested_action ?? "—" },
              ]}
            />

            {reviewing.action_taken ? (
              <div className="ak-note">
                <p className="numu-label">
                  Already decided · {reviewing.action_taken} ·{" "}
                  {formatDateTime(reviewing.action_taken_at)}
                </p>
                <p>{reviewing.action_note ?? "No reason recorded."}</p>
              </div>
            ) : (
              <FormField
                label="Reason"
                required
                htmlFor="risk-reason"
                hint="What did you check, and what did you find? This is what the next reviewer reads."
              >
                <Textarea
                  id="risk-reason"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Called the customer, address confirmed, releasing."
                />
              </FormField>
            )}

            <Button
              variant="ghost"
              size="sm"
              iconEnd="arrowRight"
              onClick={() => navigate(`/orders?q=${reviewing.order_number ?? ""}`)}
            >
              Open the order
            </Button>
          </div>
        ) : null}
      </Drawer>
    </DashboardLayout>
  );
}
