/**
 * Apps & Partners → Partners: the Partner program queue (apps plan, Phase 2).
 *
 * Outside developers apply from the merchant hub (/partners). An operator
 * works this queue:
 *
 *   pending   → approve, or reject with a reason in Arabic AND English
 *   approved  → suspend with a reason in both languages
 *   suspended → reinstate
 *   rejected  → nothing here; the partner may apply again
 *
 * Approving a partner gives an outsider a path toward merchant data, so every
 * decision needs the 2FA step-up and is written to audit_logs. The program
 * itself is dark until opened with the switch at the top: while it is closed
 * every partner-facing route 404s, but this queue still works.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  FormField,
  KeyValue,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  type KeyValueItem,
  type StatusBadgeProps,
} from "@/ds";
import { formatDateTime } from "@/lib/format";
import { is2FAError } from "@/services/platformCapabilitiesApi";
import {
  decidePartner,
  getProgram,
  listPartners,
  setProgram,
  suspendPartner,
  type AdminPartner,
  type PartnerStatus,
} from "@/services/partnersApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type Filter = PartnerStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "all", label: "All" },
];

const STATUS: Record<PartnerStatus, { status: StatusBadgeProps["status"]; label?: string }> = {
  pending: { status: "pending" },
  approved: { status: "active", label: "Approved" },
  rejected: { status: "failed", label: "Rejected" },
  suspended: { status: "suspended" },
};

/** Which note dialog is open, and for whom. */
type NoteDialog = { partner: AdminPartner; kind: "reject" | "suspend" } | null;

function onError(err: unknown) {
  if (is2FAError(err)) {
    toast.error("2FA step-up required", {
      description: "Verify your second factor again, then retry the decision.",
    });
    return;
  }
  toast.error(err instanceof Error ? err.message : String(err));
}

function ProgramSwitch() {
  const queryClient = useQueryClient();
  const program = useQuery({ queryKey: ["partners", "program"], queryFn: getProgram });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setProgram(enabled),
    onSuccess: (state) => {
      toast.success(state.enabled ? "Partner program opened" : "Partner program closed", {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["partners", "program"] });
    },
    onError,
  });
  const enabled = program.data?.enabled ?? false;
  return (
    <Card
      title="Partner program"
      actions={<StatusBadge status={enabled ? "active" : "archived"} label={enabled ? "Open" : "Closed"} />}
      footer={
        <Button
          size="sm"
          variant={enabled ? "outline" : "primary"}
          loading={toggle.isPending}
          disabled={program.isLoading}
          onClick={() => toggle.mutate(!enabled)}
        >
          {enabled ? "Close the program" : "Open the program"}
        </Button>
      }
    >
      <p className="text-muted-foreground">
        {enabled
          ? "Open: developers can apply, and approved partners can create development stores."
          : "Closed: every partner-facing route answers 404. Approved theme developers can still upload."}
      </p>
    </Card>
  );
}

function PartnerCard({
  partner,
  busy,
  onApprove,
  onReinstate,
  onNote,
}: {
  partner: AdminPartner;
  busy: boolean;
  onApprove: () => void;
  onReinstate: () => void;
  onNote: (kind: "reject" | "suspend") => void;
}) {
  const facts: KeyValueItem[] = [
    { label: "Kind", value: partner.kind === "company" ? "Company" : "Individual" },
    { label: "Legal name", value: partner.legal_name ?? "—" },
    { label: "Account email", value: `${partner.user_email}${partner.email_verified ? "" : " (unverified)"}`, mono: true },
    { label: "Support email", value: partner.support_email, mono: true },
    { label: "Support phone", value: partner.support_phone ?? "—", mono: true },
    { label: "Website", value: partner.website_url ?? "—", mono: true },
    { label: "Country", value: partner.country, mono: true },
    { label: "Agreement", value: partner.agreement_version ?? "—", mono: true },
    { label: "Applied", value: formatDateTime(partner.created_at), mono: true },
    { label: "Dev stores / themes", value: `${partner.dev_store_count} / ${partner.theme_count}`, mono: true },
  ];
  if (partner.review_notes?.en) {
    facts.push({ label: "Notes (en)", value: partner.review_notes.en });
  }
  if (partner.review_notes?.ar) {
    facts.push({ label: "Notes (ar)", value: <span dir="rtl">{partner.review_notes.ar}</span> });
  }

  return (
    <Card
      title={partner.display_name}
      subtitle={partner.user_email}
      actions={<StatusBadge {...STATUS[partner.status]} />}
      footer={
        <div className="ak-cell-line">
          {partner.status === "pending" ? (
            <>
              <Button size="sm" variant="primary" icon="check" disabled={busy} onClick={onApprove}>
                Approve
              </Button>
              <Button size="sm" variant="outline" icon="x" disabled={busy} onClick={() => onNote("reject")}>
                Reject
              </Button>
            </>
          ) : null}
          {partner.status === "approved" ? (
            <Button size="sm" variant="outline" icon="slash" disabled={busy} onClick={() => onNote("suspend")}>
              Suspend
            </Button>
          ) : null}
          {partner.status === "suspended" ? (
            <Button size="sm" variant="primary" icon="refresh" disabled={busy} onClick={onReinstate}>
              Reinstate
            </Button>
          ) : null}
        </div>
      }
    >
      <KeyValue items={facts} />
    </Card>
  );
}

export default function Partners() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NoteDialog>(null);
  const [noteAr, setNoteAr] = useState("");
  const [noteEn, setNoteEn] = useState("");

  const partnersQuery = useQuery({
    queryKey: ["partners", "list", filter],
    queryFn: () => listPartners(filter === "all" ? undefined : filter),
    refetchInterval: 30_000,
  });

  const act = useMutation({
    mutationFn: (fn: () => Promise<AdminPartner>) => fn(),
    onSettled: () => setActingId(null),
    onSuccess: (updated) => {
      toast.success(`${updated.display_name}: ${updated.status}`, {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["partners", "list"] });
    },
    onError,
  });
  const run = (id: string, fn: () => Promise<AdminPartner>) => {
    setActingId(id);
    act.mutate(fn);
  };

  const partners = partnersQuery.data ?? [];
  const noteOk = noteAr.trim().length > 0 && noteEn.trim().length > 0;

  return (
    <DashboardLayout
      title="Partners"
      subtitle="Outside developers who build apps and themes on NUMU."
      actions={
        <Button
          variant="subtle"
          icon="refresh"
          loading={partnersQuery.isFetching}
          onClick={() => void partnersQuery.refetch()}
        >
          Refresh
        </Button>
      }
      tabs={
        <Tabs
          tabs={FILTERS.map((f) => ({ id: f.value, label: f.label }))}
          active={filter}
          onChange={(id) => setFilter(id as Filter)}
        />
      }
    >
      <ProgramSwitch />

      {partnersQuery.isError ? (
        <Card>
          <EmptyState
            kind="error"
            title="Partners failed to load"
            body={partnersQuery.error instanceof Error ? partnersQuery.error.message : "The request did not complete."}
            action={
              <Button size="sm" onClick={() => void partnersQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {partnersQuery.isLoading ? (
        <div className="ak-2col">
          {[0, 1].map((i) => (
            <Skeleton key={i} height={260} variant="block" />
          ))}
        </div>
      ) : null}

      {!partnersQuery.isLoading && !partnersQuery.isError && partners.length === 0 ? (
        <Card>
          <EmptyState
            kind={filter === "pending" ? "empty" : "noResults"}
            icon="inbox"
            title={filter === "pending" ? "Queue is clear" : "Nothing here"}
            body="No partners in this view right now."
          />
        </Card>
      ) : null}

      <div className="ak-2col">
        {partners.map((p) => (
          <PartnerCard
            key={p.id}
            partner={p}
            busy={act.isPending && actingId === p.id}
            onApprove={() => run(p.id, () => decidePartner(p.id, { decision: "approve" }))}
            onReinstate={() => run(p.id, () => suspendPartner(p.id, { suspend: false }))}
            onNote={(kind) => {
              setNoteAr("");
              setNoteEn("");
              setDialog({ partner: p, kind });
            }}
          />
        ))}
      </div>

      <Dialog
        open={dialog !== null}
        tone="danger"
        title={dialog?.kind === "reject" ? "Reject this application?" : "Suspend this partner?"}
        description={
          dialog?.kind === "reject"
            ? "The partner sees this reason in the hub, in their language, and may apply again."
            : "The partner can no longer upload themes, submit work or create development stores. Their existing stores stay."
        }
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!noteOk}
              onClick={() => {
                if (!dialog) return;
                const { partner, kind } = dialog;
                run(partner.id, () =>
                  kind === "reject"
                    ? decidePartner(partner.id, { decision: "reject", notes_ar: noteAr.trim(), notes_en: noteEn.trim() })
                    : suspendPartner(partner.id, { suspend: true, reason_ar: noteAr.trim(), reason_en: noteEn.trim() }),
                );
                setDialog(null);
              }}
            >
              {dialog?.kind === "reject" ? "Reject application" : "Suspend partner"}
            </Button>
          </>
        }
      >
        <FormField label="Reason (Arabic, Egyptian)" required htmlFor="partner-note-ar">
          <Textarea id="partner-note-ar" dir="rtl" rows={3} value={noteAr} onChange={(e) => setNoteAr(e.target.value)} />
        </FormField>
        <FormField label="Reason (English)" required htmlFor="partner-note-en">
          <Textarea id="partner-note-en" rows={3} value={noteEn} onChange={(e) => setNoteEn(e.target.value)} />
        </FormField>
      </Dialog>
    </DashboardLayout>
  );
}
