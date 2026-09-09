/**
 * Merchants — the list pattern.
 *
 * Saved views, scoped search, facet filters, a dense sortable table and
 * pagination in the card footer. Row click opens the merchant; the action
 * column swallows its own clicks so the two never fight.
 *
 * Two behaviours changed with the redesign, both because the design system
 * requires it. Suspending a store is now gated behind a typed confirmation
 * that names the store and lists what suspension actually does — it used to
 * be a plain dropdown two clicks from the row. And signing in as a merchant
 * states, before it happens, that every action is attributed to the operator.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  FormField,
  IconButton,
  Input,
  MetricCard,
  Pagination,
  Select,
  StatusBadge,
  type DataTableColumn,
} from "@/ds";
import { formatDate, formatMoneyShort, formatNumber } from "@/lib/format";
import {
  getMerchantStats,
  getMerchants,
  impersonateMerchant,
  setFounderCohort,
  setInstapayOcrProvider,
  toggleMerchantInternal,
  updateMerchantStatus,
  type InstapayOcrProvider,
  type Merchant,
} from "@/services/merchantService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STATUS_BADGE = {
  active: "active",
  pending_approval: "pending",
  suspended: "suspended",
  inactive: "archived",
} as const;

const VIEWS = [
  { id: "all", label: "All merchants" },
  { id: "active", label: "Active" },
  { id: "pending_approval", label: "Awaiting approval" },
  { id: "suspended", label: "Suspended" },
  { id: "inactive", label: "Inactive" },
];

const PAGE_SIZE = 20;

export default function Merchants() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);

  const [suspending, setSuspending] = useState<Merchant | null>(null);
  const [impersonating, setImpersonating] = useState<Merchant | null>(null);
  const [ocrTarget, setOcrTarget] = useState<Merchant | null>(null);
  const [ocrProvider, setOcrProvider] = useState<InstapayOcrProvider>("none");
  const [ocrPrivacyAck, setOcrPrivacyAck] = useState(false);
  const [founderTarget, setFounderTarget] = useState<Merchant | null>(null);
  const [founderYear, setFounderYear] = useState("");

  const queryParams = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    status: view !== "all" ? view : undefined,
    search: search || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["merchants", "list", queryParams],
    queryFn: () => getMerchants(queryParams),
  });
  const { data: stats } = useQuery({
    queryKey: ["merchants", "stats"],
    queryFn: getMerchantStats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["merchants"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateMerchantStatus(id, status),
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "suspended" ? "Store suspended" : "Store status updated",
        { description: `${v.id} · recorded in the audit log` },
      );
      setSuspending(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Status change failed"),
  });

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => impersonateMerchant(id),
    onSuccess: (d) => {
      toast.success("Session started", { description: `Signed in as ${d.owner_email}` });
      setImpersonating(null);
      window.open(d.dashboard_url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => toast.error((e as Error).message || "Could not start the session"),
  });

  const internalMutation = useMutation({
    mutationFn: ({ id, isInternal }: { id: string; isInternal: boolean }) =>
      toggleMerchantInternal(id, isInternal),
    onSuccess: (_d, v) => {
      toast.success(
        v.isInternal
          ? "Marked internal — excluded from every platform aggregate"
          : "Marked real — included in platform aggregates",
      );
      invalidate();
    },
    onError: () => toast.error("Could not change the internal flag"),
  });

  // Founder-merchant badge. Not a plain toggle: granting it needs a COHORT
  // YEAR, and the year has to be the merchant's real join year or the badge
  // on their storefront becomes a false claim. The dialog opens pre-filled
  // from their signup date, so the honest value is the default one.
  const founderMutation = useMutation({
    mutationFn: ({ id, cohort }: { id: string; cohort: string | null }) =>
      setFounderCohort(id, cohort),
    onSuccess: (_d, v) => {
      toast.success(
        v.cohort ? `Founder badge granted — class of ${v.cohort}` : "Founder badge removed",
      );
      setFounderTarget(null);
      invalidate();
    },
    onError: () => toast.error("Could not update founder status"),
  });

  const openFounderDialog = (m: Merchant) => {
    setFounderTarget(m);
    // Their actual signup year, so the default is the true one.
    setFounderYear(m.founderCohort ?? String(m.createdAt.getFullYear()));
  };

  const ocrMutation = useMutation({
    mutationFn: ({ id, provider }: { id: string; provider: InstapayOcrProvider }) =>
      setInstapayOcrProvider(id, provider),
    onSuccess: () => {
      toast.success("InstaPay OCR provider updated");
      setOcrTarget(null);
      setOcrPrivacyAck(false);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Could not set the provider"),
  });

  // Public HuggingFace Spaces process the customer's payment screenshot on
  // infrastructure NUMU does not control, so that choice carries a
  // disclosure the operator has to accept.
  const requiresPrivacyAck = ocrProvider === "deepseek_hf" || ocrProvider === "glm_hf";

  const columns: DataTableColumn<Merchant>[] = [
    {
      key: "name",
      header: "Merchant",
      render: (m) => (
        <div>
          <div className="ntb__primary ak-cell-line">
            <span>{m.name}</span>
            {m.isInternal ? <Badge tone="warning" icon="flag" square>Internal</Badge> : null}
            {m.founderCohort ? (
              <Badge
                tone="warning"
                icon="star"
                square
                title={`Founder merchant — class of ${m.founderCohort}`}
              >
                Founder {m.founderCohort}
              </Badge>
            ) : null}
          </div>
          <div className="ntb__sub numu-email">{m.email}</div>
        </div>
      ),
    },
    {
      key: "domain",
      header: "Domain",
      mono: true,
      render: (m) =>
        m.domain ? (
          <a
            href={`https://${m.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {m.domain}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusBadge status={STATUS_BADGE[m.status] ?? "archived"} />,
    },
    {
      key: "plan",
      header: "Plan",
      render: (m) => <Badge tone="neutral" square>{m.plan}</Badge>,
    },
    {
      key: "totalRevenue",
      header: "Revenue",
      align: "end",
      mono: true,
      render: (m) => formatMoneyShort(m.totalRevenue),
    },
    {
      key: "totalOrders",
      header: "Orders",
      align: "end",
      mono: true,
      render: (m) => formatNumber(m.totalOrders),
    },
    {
      key: "createdAt",
      header: "Joined",
      mono: true,
      render: (m) => formatDate(m.createdAt),
    },
    {
      key: "actions",
      header: "",
      width: 150,
      render: (m) => (
        <div className="ak-rowactions" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon="flag"
            label={m.isInternal ? "Mark as a real merchant" : "Mark as internal"}
            size="sm"
            disabled={internalMutation.isPending}
            onClick={() =>
              internalMutation.mutate({ id: m.merchantId, isInternal: !m.isInternal })
            }
          />
          <IconButton
            icon="star"
            label={
              m.founderCohort
                ? `Founder merchant (${m.founderCohort}) — change or remove`
                : "Mark as a founder merchant"
            }
            size="sm"
            onClick={() => openFounderDialog(m)}
          />
          <IconButton
            icon="eye"
            label="InstaPay OCR provider"
            size="sm"
            onClick={() => {
              setOcrTarget(m);
              // The list endpoint does not carry the current provider, so
              // the dialog opens neutral and the operator picks afresh.
              setOcrProvider("none");
              setOcrPrivacyAck(false);
            }}
          />
          <IconButton
            icon="logOut"
            label="View the hub as this merchant"
            size="sm"
            disabled={impersonateMutation.isPending}
            onClick={() => setImpersonating(m)}
          />
          {m.status === "suspended" ? (
            <IconButton
              icon="playCircle"
              label="Reinstate this store"
              size="sm"
              onClick={() =>
                statusMutation.mutate({ id: m.merchantId, status: "active" })
              }
            />
          ) : (
            <IconButton
              icon="slash"
              label="Suspend this store"
              size="sm"
              onClick={() => setSuspending(m)}
            />
          )}
        </div>
      ),
    },
  ];

  const merchants = data?.merchants ?? [];

  return (
    <DashboardLayout
      title="Merchants"
      subtitle="Every store on the platform, including internal ones."
    >
      <div className="ak-metrics ak-metrics--4">
        <MetricCard
          label="Total"
          value={formatNumber(stats?.total)}
          icon="building"
          flat
          onClick={() => setView("all")}
        />
        <MetricCard
          label="Active"
          value={formatNumber(stats?.active)}
          icon="check"
          flat
          onClick={() => setView("active")}
        />
        <MetricCard
          label="Awaiting approval"
          value={formatNumber(stats?.pending_approval)}
          icon="clock"
          flat
          alert={Boolean(stats?.pending_approval)}
          onClick={() => setView("pending_approval")}
        />
        <MetricCard
          label="Suspended"
          value={formatNumber(stats?.suspended)}
          icon="slash"
          flat
          onClick={() => setView("suspended")}
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
          searchPlaceholder="Name, email or subdomain"
          actions={
            <Button
              variant="subtle"
              size="sm"
              icon="download"
              onClick={() => exportCsv(merchants)}
            >
              Export CSV
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={merchants}
          rowKey={(m) => m.merchantId}
          loading={isLoading}
          caption="Merchants on the platform"
          onRowClick={(m) => navigate(`/merchants/${m.merchantId}`)}
          isFlagged={(m) => m.status === "suspended"}
          empty={
            <EmptyState
              kind={search || view !== "all" ? "noResults" : "empty"}
              title={search || view !== "all" ? "Nothing matches" : "No merchants yet"}
              body={
                search || view !== "all"
                  ? "Widen the search or switch to another saved view."
                  : "A merchant appears here as soon as their first store is created."
              }
              action={
                search || view !== "all" ? (
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

      <ConfirmDialog
        open={Boolean(suspending)}
        tone="danger"
        title={`Suspend ${suspending?.name}?`}
        entity={[
          { label: "Store", value: suspending?.name ?? "" },
          { label: "Store ID", value: suspending?.merchantId ?? "", mono: true },
          { label: "Domain", value: suspending?.domain ?? "—", mono: true },
        ]}
        consequences={[
          "The storefront stops serving shoppers immediately.",
          `${formatNumber(suspending?.totalOrders)} orders stay visible but cannot be fulfilled.`,
          "The merchant sees a suspension notice in the Merchant Hub.",
          "Reinstating the store restores it exactly as it was.",
        ]}
        confirmPhrase={suspending?.merchantId}
        confirmLabel="Suspend store"
        onClose={() => setSuspending(null)}
        onConfirm={() =>
          suspending &&
          statusMutation.mutate({ id: suspending.merchantId, status: "suspended" })
        }
      />

      <ConfirmDialog
        open={Boolean(impersonating)}
        tone="warning"
        title={`Open the hub as ${impersonating?.name}?`}
        entity={[
          { label: "Store", value: impersonating?.name ?? "" },
          { label: "Store ID", value: impersonating?.merchantId ?? "", mono: true },
          { label: "Owner", value: impersonating?.email ?? "", mono: true },
        ]}
        consequences={[
          "You see the Merchant Hub exactly as the owner does.",
          "Every action you take is attributed to your account, not theirs.",
          "The hub opens in a new tab; closing it ends the session.",
        ]}
        confirmLabel="Start session"
        onClose={() => setImpersonating(null)}
        onConfirm={() =>
          impersonating && impersonateMutation.mutate(impersonating.merchantId)
        }
      />

      <Dialog
        open={Boolean(ocrTarget)}
        title="InstaPay OCR provider"
        description={
          ocrTarget
            ? `Which engine reads ${ocrTarget.name}'s payment-proof screenshots. Merchants cannot change this themselves.`
            : undefined
        }
        onClose={() => setOcrTarget(null)}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOcrTarget(null)}
              disabled={ocrMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              loading={ocrMutation.isPending}
              disabled={requiresPrivacyAck && !ocrPrivacyAck}
              onClick={() =>
                ocrTarget &&
                ocrMutation.mutate({ id: ocrTarget.merchantId, provider: ocrProvider })
              }
            >
              Save provider
            </Button>
          </>
        }
      >
        <FormField label="Provider" hint="Cost and language coverage differ per engine.">
          <Select
            value={ocrProvider}
            onChange={(e) => {
              setOcrProvider(e.target.value as InstapayOcrProvider);
              setOcrPrivacyAck(false);
            }}
            options={[
              { value: "none", label: "None — no OCR for this store" },
              { value: "google_vision", label: "Google Vision — paid, Arabic and Latin" },
              { value: "deepseek_hf", label: "DeepSeek-OCR — free, public Space, Latin only" },
              { value: "glm_hf", label: "GLM-OCR — free, public Space, Latin only" },
            ]}
          />
        </FormField>
        {requiresPrivacyAck ? (
          <div
            style={{
              marginTop: "var(--sp-4)",
              padding: "var(--sp-3)",
              borderRadius: "var(--radius-inset)",
              background: "var(--status-warning-tint)",
            }}
          >
            <Checkbox
              checked={ocrPrivacyAck}
              onChange={(e) => setOcrPrivacyAck(e.target.checked)}
              label="Customer payment screenshots will be processed on a public HuggingFace Space. Confirm with the merchant before enabling this on live traffic."
            />
          </div>
        ) : null}
      </Dialog>

      {/* Founder-merchant badge. A cohort YEAR, never a rank: a rank would tell
          merchant #42 that 41 came before them, publishing how many merchants
          are on the platform to every merchant — and, once the badge reaches a
          storefront, to every shopper. */}
      <Dialog
        open={Boolean(founderTarget)}
        title="Founder merchant"
        description={
          founderTarget
            ? `${founderTarget.name} joined in ${founderTarget.createdAt.getFullYear()}. The badge shows this year on their storefront, so it should be the year they actually joined — not the year you are granting it.`
            : undefined
        }
        width={460}
        onClose={() => setFounderTarget(null)}
        footer={
          <>
            {founderTarget?.founderCohort ? (
              <Button
                variant="danger-outline"
                disabled={founderMutation.isPending}
                onClick={() =>
                  founderMutation.mutate({ id: founderTarget.merchantId, cohort: null })
                }
              >
                Remove badge
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setFounderTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={founderMutation.isPending}
              disabled={founderYear.length !== 4}
              onClick={() =>
                founderTarget &&
                founderMutation.mutate({
                  id: founderTarget.merchantId,
                  cohort: founderYear,
                })
              }
            >
              Grant
            </Button>
          </>
        }
      >
        <FormField
          label="Cohort year"
          hint="Applies to the merchant, so it appears on every store they own."
        >
          <Input
            mono
            inputMode="numeric"
            value={founderYear}
            onChange={(e) => setFounderYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2025"
          />
        </FormField>
      </Dialog>
    </DashboardLayout>
  );
}

/**
 * Export what is on screen, not what is in the database.
 *
 * An operator exporting a filtered list expects the filtered list. Pulling
 * every page server-side would silently hand them a different dataset from
 * the one they were looking at.
 */
function exportCsv(rows: Merchant[]) {
  if (!rows.length) {
    toast.message("Nothing to export", { description: "The current view is empty." });
    return;
  }
  const header = ["store_id", "name", "email", "domain", "status", "plan", "revenue_piasters", "orders", "created_at"];
  const body = rows.map((m) =>
    [
      m.merchantId,
      m.name,
      m.email,
      m.domain ?? "",
      m.status,
      m.plan,
      String(m.totalRevenue ?? 0),
      String(m.totalOrders ?? 0),
      m.createdAt.toISOString(),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `numu-merchants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
