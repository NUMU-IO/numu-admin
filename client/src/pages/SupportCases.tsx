/**
 * Support cases — what staff owe a merchant.
 *
 * The queue is urgent-first and then oldest-first: priority decides what to
 * pick up, age decides between two equally urgent ones. Resolving or closing
 * a case requires writing what happened — a closed case with no resolution
 * answers nothing for whoever reads it next.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  FilterBar,
  FormField,
  Input,
  KeyValue,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  type DataTableColumn,
} from "@/ds";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import {
  createSupportCase,
  listSupportCases,
  updateSupportCase,
  type CasePriority,
  type CaseStatus,
  type CaseStatusFilter,
  type SupportCase,
} from "@/services/supportCasesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const VIEWS: { id: CaseStatusFilter; label: string }[] = [
  { id: "unresolved", label: "Unresolved" },
  { id: "open", label: "Open" },
  { id: "pending_merchant", label: "Waiting on merchant" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

const STATUS_BADGE: Record<CaseStatus, "open" | "pending" | "resolved" | "closed"> = {
  open: "open",
  pending_merchant: "pending",
  resolved: "resolved",
  closed: "closed",
};

const PRIORITY_TONE: Record<CasePriority, "danger" | "warning" | "neutral" | "info"> = {
  urgent: "danger",
  high: "warning",
  normal: "info",
  low: "neutral",
};

export default function SupportCases() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<CaseStatusFilter>("unresolved");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [openCase, setOpenCase] = useState<SupportCase | null>(null);
  const [resolution, setResolution] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    subject: "",
    body: "",
    priority: "normal" as CasePriority,
    category: "",
  });

  const params = {
    status: view,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["support-cases", params],
    queryFn: () => listSupportCases(params),
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["support-cases"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const create = useMutation({
    mutationFn: () =>
      createSupportCase({
        subject: draft.subject,
        body: draft.body || undefined,
        priority: draft.priority,
        category: draft.category || undefined,
      }),
    onSuccess: () => {
      toast.success("Case opened");
      setCreating(false);
      setDraft({ subject: "", body: "", priority: "normal", category: "" });
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "The case was not created"),
  });

  const update = useMutation({
    mutationFn: (vars: {
      id: string;
      status?: CaseStatus;
      priority?: CasePriority;
      resolution?: string;
    }) => updateSupportCase(vars.id, vars),
    onSuccess: (updated) => {
      toast.success("Case updated", { description: `Now ${updated.status}` });
      setOpenCase(updated);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "The case was not updated"),
  });

  const columns: DataTableColumn<SupportCase>[] = [
    {
      key: "priority",
      header: "Priority",
      render: (c) => (
        <Badge tone={PRIORITY_TONE[c.priority]} square>
          {c.priority}
        </Badge>
      ),
    },
    {
      key: "subject",
      header: "Case",
      render: (c) => (
        <div>
          <div className="ntb__primary">{c.subject}</div>
          <div className="ntb__sub">{c.category ?? "uncategorised"}</div>
        </div>
      ),
    },
    { key: "store_name", header: "Merchant", render: (c) => c.store_name ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <StatusBadge
          status={STATUS_BADGE[c.status]}
          label={c.status === "pending_merchant" ? "Waiting on merchant" : undefined}
        />
      ),
    },
    {
      key: "assignee_email",
      header: "Owner",
      mono: true,
      render: (c) => c.assignee_email ?? "unassigned",
    },
    {
      key: "created_at",
      header: "Opened",
      mono: true,
      render: (c) => formatRelative(c.created_at),
    },
  ];

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  return (
    <DashboardLayout
      title="Support cases"
      subtitle="What staff owe a merchant. Urgent first, then oldest."
      meta={
        <>
          <span>{formatNumber(counts.unresolved)} unresolved</span>
          <span>{formatNumber(counts.open)} open</span>
          <span>{formatNumber(counts.pending_merchant)} waiting on merchant</span>
        </>
      }
      actions={
        <Button icon="plus" onClick={() => setCreating(true)}>
          Open a case
        </Button>
      }
    >
      <Card flush>
        <FilterBar
          savedViews={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
          activeView={view}
          onViewChange={(id) => {
            setView(id as CaseStatusFilter);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Subject, body or merchant"
          actions={<span className="numu-label">{formatNumber(data?.total)} cases</span>}
        />
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(c) => c.id}
          dense
          loading={isLoading}
          caption="Support cases"
          onRowClick={(c) => {
            setOpenCase(c);
            setResolution(c.resolution ?? "");
          }}
          isFlagged={(c) => c.priority === "urgent" && c.status === "open"}
          empty={
            <EmptyState
              kind={search ? "noResults" : "empty"}
              icon="inbox"
              title={view === "unresolved" ? "Nothing outstanding" : "Nothing matches"}
              body={
                view === "unresolved"
                  ? "No case is open or waiting on a merchant."
                  : "Widen the search or switch to another view."
              }
              action={
                <Button size="sm" icon="plus" onClick={() => setCreating(true)}>
                  Open a case
                </Button>
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

      {/* Detail + the actions that move a case along. */}
      <Drawer
        open={Boolean(openCase)}
        title={openCase?.subject ?? "Case"}
        onClose={() => setOpenCase(null)}
        footer={
          openCase && openCase.status !== "closed" ? (
            <>
              <Button variant="ghost" onClick={() => setOpenCase(null)}>
                Close panel
              </Button>
              {openCase.status !== "pending_merchant" ? (
                <Button
                  variant="subtle"
                  icon="clock"
                  onClick={() =>
                    update.mutate({ id: openCase.id, status: "pending_merchant" })
                  }
                >
                  Waiting on merchant
                </Button>
              ) : null}
              <Button
                icon="check"
                loading={update.isPending}
                disabled={resolution.trim().length < 3}
                onClick={() =>
                  update.mutate({
                    id: openCase.id,
                    status: "resolved",
                    resolution,
                  })
                }
              >
                Resolve
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setOpenCase(null)}>
              Close panel
            </Button>
          )
        }
      >
        {openCase ? (
          <div className="ak-stack">
            <div className="ak-cell-line">
              <StatusBadge status={STATUS_BADGE[openCase.status]} />
              <Badge tone={PRIORITY_TONE[openCase.priority]} square>
                {openCase.priority}
              </Badge>
            </div>

            {openCase.body ? (
              <div className="ak-note">
                <p className="numu-label">Reported</p>
                <p>{openCase.body}</p>
              </div>
            ) : null}

            <KeyValue
              items={[
                { label: "Merchant", value: openCase.store_name ?? "—" },
                { label: "Category", value: openCase.category ?? "—" },
                { label: "Reporter", value: openCase.reporter_email ?? "—", mono: true },
                { label: "Owner", value: openCase.assignee_email ?? "unassigned", mono: true },
                { label: "Opened", value: formatDateTime(openCase.created_at), mono: true },
                {
                  label: "First touched",
                  value: formatDateTime(openCase.first_response_at),
                  mono: true,
                },
                { label: "Resolved", value: formatDateTime(openCase.resolved_at), mono: true },
              ]}
            />

            {openCase.status === "closed" || openCase.status === "resolved" ? (
              <div className="ak-note">
                <p className="numu-label">Resolution</p>
                <p>{openCase.resolution ?? "None recorded."}</p>
              </div>
            ) : (
              <FormField
                label="Resolution"
                required
                htmlFor="case-resolution"
                hint="What actually happened. Required to resolve the case."
              >
                <Textarea
                  id="case-resolution"
                  rows={4}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="e.g. Rebuilt the theme cache; merchant confirmed the storefront is correct."
                />
              </FormField>
            )}

            <FormField label="Priority" htmlFor="case-priority">
              <Select
                id="case-priority"
                value={openCase.priority}
                onChange={(e) =>
                  update.mutate({
                    id: openCase.id,
                    priority: e.target.value as CasePriority,
                  })
                }
                options={[
                  { value: "urgent", label: "Urgent" },
                  { value: "high", label: "High" },
                  { value: "normal", label: "Normal" },
                  { value: "low", label: "Low" },
                ]}
              />
            </FormField>
          </div>
        ) : null}
      </Drawer>

      <Dialog
        open={creating}
        title="Open a support case"
        description="Anything staff owe a merchant an answer on."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={draft.subject.trim().length < 3}
              onClick={() => create.mutate()}
            >
              Open case
            </Button>
          </>
        }
      >
        <div className="ak-stack">
          <FormField label="Subject" required htmlFor="case-subject">
            <Input
              id="case-subject"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Checkout returns 500 on COD orders"
            />
          </FormField>
          <FormField label="What happened" htmlFor="case-body">
            <Textarea
              id="case-body"
              rows={4}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="What the merchant reported, and anything already checked."
            />
          </FormField>
          <FormField label="Priority" htmlFor="new-case-priority">
            <Select
              id="new-case-priority"
              value={draft.priority}
              onChange={(e) =>
                setDraft({ ...draft, priority: e.target.value as CasePriority })
              }
              options={[
                { value: "urgent", label: "Urgent — merchant cannot trade" },
                { value: "high", label: "High — a core flow is broken" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low — a question" },
              ]}
            />
          </FormField>
          <FormField label="Category" htmlFor="case-category" hint="checkout, billing, whatsapp, themes…">
            <Input
              id="case-category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="checkout"
            />
          </FormField>
        </div>
      </Dialog>
    </DashboardLayout>
  );
}
