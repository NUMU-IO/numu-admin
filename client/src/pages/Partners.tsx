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
 *
 * Paid apps (Phase 7): the second switch lets partners sell recurring apps
 * through NUMU billing, and stays off until counsel signs off. Each approved
 * or suspended partner has a Ledger: what NUMU owes them, and the forms that
 * record a bank transfer already sent (payout) or a signed correction
 * (adjustment). No money moves from this page.
 *
 * Referrals & directory: per partner, the referral terms (share of referred
 * merchants' plan payments and for how long), the stores they referred
 * (reassign by subdomain), the Verified badge, and hiding their public
 * "Hire an expert" profile.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  MetricCard,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  type DataTableColumn,
  type KeyValueItem,
  type StatusBadgeProps,
} from "@/ds";
import { formatDateTime, formatMoney, parseMoney } from "@/lib/format";
import { RefundChargeDialog } from "@/pages/AppBilling";
import { is2FAError } from "@/services/platformCapabilitiesApi";
import {
  assignReferral,
  decidePartner,
  downloadStatementCsv,
  getLedger,
  getReferrals,
  getStatement,
  getPartnerBilling,
  getProgram,
  listPartners,
  recordAdjustment,
  recordPayout,
  removeReferral,
  setDirectoryFlags,
  setPartnerBilling,
  setProgram,
  setReferralTerms,
  suspendPartner,
  type AdminPartner,
  type LedgerEntry,
  type PartnerStatus,
  type ReferredStore,
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

/** Shown on the card and again in the confirmation, word for word. */
const BILLING_GATE =
  "Turn this on only after counsel signs off on VAT, e-invoicing, withholding tax and the " +
  "collect-and-pay-out structure, and NUMU has announced in writing that billing is live " +
  "(draft Partner Agreement § 11.1).";

function BillingSwitch() {
  const queryClient = useQueryClient();
  const billing = useQuery({ queryKey: ["partners", "billing"], queryFn: getPartnerBilling });
  const [confirming, setConfirming] = useState(false);
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setPartnerBilling(enabled),
    onSuccess: (state) => {
      toast.success(state.enabled ? "NUMU billing for Partner Apps is on" : "NUMU billing for Partner Apps is off", {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["partners", "billing"] });
    },
    onError,
  });
  const enabled = billing.data?.enabled ?? false;
  return (
    <>
      <Card
        title="NUMU billing for Partner Apps"
        actions={billing.data ? <StatusBadge status={enabled ? "active" : "archived"} label={enabled ? "On" : "Off"} /> : null}
        footer={
          <Button
            size="sm"
            variant={enabled ? "outline" : "danger-outline"}
            loading={toggle.isPending}
            disabled={!billing.data}
            onClick={() => (enabled ? toggle.mutate(false) : setConfirming(true))}
          >
            {enabled ? "Turn billing off" : "Turn billing on…"}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-muted-foreground">
            {billing.isError
              ? `The switch failed to load: ${billing.error instanceof Error ? billing.error.message : "request failed"}`
              : enabled
                ? "On: partners may sell apps with a recurring price. Merchants pay from their NUMU wallet every cycle; NUMU keeps 20% and owes the partner 80%."
                : "Off: partners may publish only free or external apps. NUMU Apps can be priced at any time in the App catalog."}
          </p>
          <Banner tone="warning" icon="alertTriangle" title="Legal gate">
            {BILLING_GATE}
          </Banner>
        </div>
      </Card>
      {confirming ? (
        <ConfirmDialog
          title="Turn on NUMU billing for Partner Apps?"
          consequences={[
            "Partners can sell apps with a recurring price once App review approves them.",
            "Merchants who subscribe are charged from their NUMU wallet every cycle. NUMU keeps 20% and owes the partner 80%, paid out by bank transfer.",
            "Turning billing off later stops new recurring apps; existing subscriptions keep renewing.",
          ]}
          confirmPhrase="counsel signed off"
          confirmLabel="Turn billing on"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            toggle.mutate(true);
          }}
        >
          <Banner tone="warning" icon="alertTriangle" title="Legal gate">
            {BILLING_GATE}
          </Banner>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

const KIND: Record<string, { label: string; tone: "success" | "info" | "warning" | "neutral" }> = {
  sale: { label: "Sale", tone: "success" },
  referral: { label: "Referral", tone: "success" },
  payout: { label: "Payout", tone: "info" },
  adjustment: { label: "Adjustment", tone: "warning" },
};

/** "+EGP 79.20" / "-EGP 79.20": ledger amounts are signed. */
function signedMoney(cents: number, currency = "EGP"): string {
  return `${cents > 0 ? "+" : ""}${formatMoney(cents, currency)}`;
}

const LEDGER_COLUMNS: DataTableColumn<LedgerEntry>[] = [
  { key: "created_at", header: "When", mono: true, render: (e) => formatDateTime(e.created_at) },
  {
    key: "kind",
    header: "Kind",
    render: (e) => {
      const k = KIND[e.kind] ?? { label: e.kind, tone: "neutral" };
      return (
        <Badge tone={k.tone} square>
          {k.label}
        </Badge>
      );
    },
  },
  { key: "amount_cents", header: "Amount", align: "end", mono: true, render: (e) => signedMoney(e.amount_cents, e.currency) },
  { key: "app_name", header: "App", render: (e) => e.app_name ?? "—" },
  { key: "reference", header: "Reference", mono: true, render: (e) => e.reference ?? "—" },
  {
    key: "note",
    header: "Detail",
    render: (e) =>
      e.kind === "sale"
        ? `Merchant paid ${formatMoney(e.gross_cents, e.currency)}; NUMU kept ${formatMoney(e.platform_fee_cents, e.currency)}`
        : (e.note ?? "—"),
  },
];

/** One month of the partner's ledger, as the partner sees it, plus CSV. */
function StatementCard({ partner }: { partner: AdminPartner }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const q = useQuery({
    queryKey: ["partners", "statement", partner.id, month],
    queryFn: () => getStatement(partner.id, month),
    enabled: valid,
  });
  const s = q.data;
  return (
    <Card variant="outlined" title="Monthly statement">
      <div className="space-y-3">
        <FormField label="Month" htmlFor="statement-month" hint="YYYY-MM, UTC">
          <Input id="statement-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </FormField>
        {q.isError ? <p className="text-sm text-destructive">{String(q.error)}</p> : null}
        {s ? (
          <KeyValue
            items={[
              { label: "Opening balance", value: formatMoney(s.opening_balance_cents), mono: true },
              { label: "Gross sales", value: formatMoney(s.gross_sales_cents), mono: true },
              { label: "NUMU fees (20%)", value: formatMoney(s.platform_fees_cents), mono: true },
              { label: "Net sales (80%)", value: signedMoney(s.net_sales_cents), mono: true },
              { label: "Refunds", value: signedMoney(s.refunds_cents), mono: true },
              { label: "Adjustments", value: signedMoney(s.adjustments_cents), mono: true },
              { label: "Payouts", value: signedMoney(s.payouts_cents), mono: true },
              { label: "Closing balance", value: formatMoney(s.closing_balance_cents), mono: true },
            ]}
          />
        ) : null}
        <Button
          size="sm"
          variant="subtle"
          icon="download"
          disabled={!valid}
          onClick={() => downloadStatementCsv(partner.id, month).catch(onError)}
        >
          Download CSV
        </Button>
      </div>
    </Card>
  );
}

type EntryKind = "payout" | "adjustment";
type Draft = { kind: EntryKind; amount_cents: number; reference: string; note: string };

/**
 * What NUMU owes one partner, and the two ways an admin changes it. Both
 * only write the ledger: a payout records a bank transfer already sent, an
 * adjustment corrects the balance (a merchant's refund is a separate wallet
 * adjustment on Merchant wallets).
 */
function LedgerDrawer({ partner, onClose }: { partner: AdminPartner; onClose: () => void }) {
  const queryClient = useQueryClient();
  const ledger = useQuery({ queryKey: ["partners", "ledger", partner.id], queryFn: () => getLedger(partner.id) });
  const [kind, setKind] = useState<EntryKind>("payout");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refunding, setRefunding] = useState<LedgerEntry | null>(null);

  const record = useMutation({
    mutationFn: (d: Draft) =>
      d.kind === "payout"
        ? recordPayout(partner.id, { amount_cents: d.amount_cents, reference: d.reference, ...(d.note ? { note: d.note } : {}) })
        : recordAdjustment(partner.id, { amount_cents: d.amount_cents, reference: d.reference, note: d.note }),
    onSuccess: (res, d) => {
      toast.success(`${d.kind === "payout" ? "Payout" : "Adjustment"} ${d.reference} recorded`, {
        description: `NUMU now owes ${partner.display_name} ${formatMoney(res.balance_cents)}. Recorded in the audit log against your account`,
      });
      setAmount("");
      setReference("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["partners", "ledger", partner.id] });
    },
    onError,
  });

  const data = ledger.data;
  const cents = parseMoney(amount);
  const amountError = !amount.trim()
    ? undefined
    : cents === null
      ? "Digits with up to 2 decimals, e.g. 1250.50"
      : cents === 0
        ? "Can't be zero"
        : kind === "payout" && cents < 0
          ? "A payout is a positive amount"
          : kind === "payout" && data && cents > data.payable_cents
            ? `More than is payable now (${formatMoney(data.payable_cents)})`
            : undefined;
  const ref = reference.trim();
  const text = note.trim();
  const ready = !!data && cents !== null && !amountError && ref.length >= 3 && (kind === "payout" || text.length >= 3);
  const payout = kind === "payout";

  return (
    <>
      <Drawer
        title={`Ledger · ${partner.display_name}`}
        subtitle={partner.id}
        width={760}
        onClose={onClose}
        footer={
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      >
        {ledger.isError ? (
          <EmptyState
            kind="error"
            title="Ledger failed to load"
            body={ledger.error instanceof Error ? ledger.error.message : "The request did not complete."}
            action={
              <Button size="sm" onClick={() => void ledger.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        <div className="ak-2col">
          <MetricCard
            label="NUMU owes"
            value={formatMoney(data?.balance_cents, data?.currency)}
            note="Every sale, payout and adjustment"
            icon="banknote"
            loading={ledger.isLoading}
          />
          <MetricCard
            label="Payable now"
            value={formatMoney(data?.payable_cents, data?.currency)}
            note="Sales stay on hold for 30 days"
            icon="clock"
            loading={ledger.isLoading}
          />
        </div>

        <Card variant="outlined" title="Record a payout or an adjustment">
          <div className="space-y-3">
            <FormField label="Type" htmlFor="ledger-kind">
              <Select
                id="ledger-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as EntryKind)}
                options={[
                  { value: "payout", label: "Payout: a bank transfer already sent" },
                  { value: "adjustment", label: "Adjustment: a signed correction" },
                ]}
              />
            </FormField>
            <p className="text-sm text-muted-foreground">
              {payout ? (
                "Send the bank transfer first, then record it here. NUMU moves no money from this page: the entry lowers what NUMU owes, up to what is payable now."
              ) : (
                <>
                  A negative amount lowers what NUMU owes this partner (e.g. -79.20 reverses their share of a charge refunded
                  to a merchant); a positive amount raises it. NUMU moves no money from this page. Refund the merchant
                  separately in{" "}
                  <a className="underline underline-offset-2" href="/wallets" target="_blank" rel="noopener noreferrer">
                    Merchant wallets
                  </a>{" "}
                  (Adjust).
                </>
              )}
            </p>
            <FormField
              label={payout ? "Amount sent" : "Amount (signed)"}
              required
              htmlFor="ledger-amount"
              error={amountError}
              hint={
                cents !== null && !amountError
                  ? payout
                    ? formatMoney(cents)
                    : signedMoney(cents)
                  : payout
                    ? `Payable now: ${formatMoney(data?.payable_cents, data?.currency)}`
                    : "Minus lowers what NUMU owes; no sign raises it"
              }
            >
              <Input
                id="ledger-amount"
                dir="ltr"
                numeric
                affix="EGP"
                inputMode="decimal"
                autoComplete="off"
                placeholder={payout ? "1250.00" : "-79.20"}
                // The affix is absolutely placed; without this an end-aligned amount runs under "EGP".
                style={{ paddingInlineEnd: 48 }}
                value={amount}
                error={!!amountError}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
            <FormField
              label={payout ? "Bank transfer reference" : "Reference"}
              required
              htmlFor="ledger-reference"
              hint={payout ? "From the bank. Each reference is recorded once." : "e.g. the refund's reference. Each reference is recorded once."}
            >
              <Input
                id="ledger-reference"
                mono
                maxLength={128}
                autoComplete="off"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </FormField>
            <FormField label="Note" required={!payout} htmlFor="ledger-note" hint={payout ? "Optional." : "Why. At least 3 characters."}>
              <Textarea id="ledger-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <Button
              variant="primary"
              icon="banknote"
              disabled={!ready}
              loading={record.isPending}
              onClick={() => cents !== null && setDraft({ kind, amount_cents: cents, reference: ref, note: text })}
            >
              {payout ? "Record payout…" : "Record adjustment…"}
            </Button>
          </div>
        </Card>

        <DataTable
          dense
          caption="Ledger entries, newest first"
          columns={[
            ...LEDGER_COLUMNS,
            {
              key: "charge_id",
              header: "",
              align: "end",
              render: (e) => {
                if (e.kind !== "sale" || !e.charge_id) return null;
                const done = data?.entries.some((x) => x.reference === `refund:${e.charge_id}`);
                return done ? (
                  <Badge tone="neutral" square>
                    Refunded
                  </Badge>
                ) : (
                  <Button size="sm" variant="subtle" onClick={() => setRefunding(e)}>
                    Refund…
                  </Button>
                );
              },
            },
          ]}
          rows={data?.entries ?? []}
          rowKey={(e) => e.id}
          loading={ledger.isLoading}
          empty={
            <EmptyState
              kind="empty"
              icon="inbox"
              title="No entries yet"
              body="A sale appears when a merchant pays for one of this partner's apps."
            />
          }
        />
        {data && data.entries.length >= 100 ? (
          <p className="text-sm text-muted-foreground">The latest 100 entries. The totals above count every entry.</p>
        ) : null}

        <StatementCard partner={partner} />
      </Drawer>

      {refunding?.charge_id ? (
        <RefundChargeDialog
          charge={{
            id: refunding.charge_id,
            amount_cents: refunding.gross_cents ?? 0,
            label: `${refunding.app_name ?? "App"} · ${formatDateTime(refunding.created_at)}`,
          }}
          onClose={() => setRefunding(null)}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ["partners"] })}
        />
      ) : null}

      {draft && data ? (
        <ConfirmDialog
          tone="warning"
          title={draft.kind === "payout" ? "Record this payout?" : "Record this adjustment?"}
          entity={[
            { label: "Partner", value: partner.display_name },
            draft.kind === "payout"
              ? { label: "Sent", value: formatMoney(draft.amount_cents), mono: true }
              : { label: "Adjustment", value: signedMoney(draft.amount_cents), mono: true },
            { label: "Reference", value: draft.reference, mono: true },
            ...(draft.note ? [{ label: "Note", value: draft.note }] : []),
          ]}
          consequences={[
            draft.kind === "payout"
              ? "Confirms the bank transfer has already left NUMU's account. Nothing is sent from here."
              : "Changes only what NUMU owes. Nothing is sent or refunded from here.",
            `What NUMU owes ${partner.display_name} goes from ${formatMoney(data.balance_cents)} to ${formatMoney(
              data.balance_cents + (draft.kind === "payout" ? -draft.amount_cents : draft.amount_cents),
            )}.`,
            "An entry can't be deleted; a mistake is corrected with an adjustment.",
          ]}
          confirmLabel={draft.kind === "payout" ? "Record payout" : "Record adjustment"}
          onClose={() => setDraft(null)}
          onConfirm={() => {
            record.mutate(draft);
            setDraft(null);
          }}
        />
      ) : null}
    </>
  );
}

const REFERRAL_COLUMNS: DataTableColumn<ReferredStore>[] = [
  { key: "store_name", header: "Store", render: (r) => r.store_name },
  { key: "signed_up_at", header: "Signed up", mono: true, render: (r) => formatDateTime(r.signed_up_at) },
  { key: "plan", header: "Plan", render: (r) => `${r.plan} · ${r.status}` },
  {
    key: "first_paid_at",
    header: "First payment",
    mono: true,
    render: (r) => (r.first_paid_at ? formatDateTime(r.first_paid_at) : "—"),
  },
  { key: "earned_cents", header: "Earned", align: "end", mono: true, render: (r) => formatMoney(r.earned_cents) },
];

/**
 * Referral terms, referred stores and the public directory flags of one
 * partner. Every write needs the 2FA step-up and is audited.
 */
function ReferralsDrawer({ partner, onClose }: { partner: AdminPartner; onClose: () => void }) {
  const queryClient = useQueryClient();
  const key = ["partners", "referrals", partner.id];
  const referrals = useQuery({ queryKey: key, queryFn: () => getReferrals(partner.id) });
  const [pct, setPct] = useState(String((partner.referral_bps ?? 2000) / 100));
  const [months, setMonths] = useState(String(partner.referral_months ?? 12));
  const [subdomain, setSubdomain] = useState("");
  const [flags, setFlags] = useState({ verified: !!partner.verified, directory_hidden: !!partner.directory_hidden });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["partners", "list"] });
  };
  const done = (msg: string) => {
    toast.success(msg, { description: "Recorded in the audit log against your account" });
    refresh();
  };

  const bps = Math.round(Number(pct) * 100);
  const monthsN = Number(months);
  const termsOk = pct.trim() !== "" && bps >= 0 && bps <= 10_000 && Number.isInteger(monthsN) && monthsN >= 1 && monthsN <= 60;

  const terms = useMutation({
    mutationFn: () => setReferralTerms(partner.id, { referral_bps: bps, referral_months: monthsN }),
    onSuccess: () => done("Referral terms saved"),
    onError,
  });
  const assign = useMutation({
    mutationFn: () => assignReferral(partner.id, subdomain.trim().toLowerCase()),
    onSuccess: () => {
      setSubdomain("");
      done("Store attributed to this partner");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (tenantId: string) => removeReferral(partner.id, tenantId),
    onSuccess: () => done("Store detached"),
    onError,
  });
  const directory = useMutation({
    mutationFn: (body: { verified?: boolean; directory_hidden?: boolean }) => setDirectoryFlags(partner.id, body),
    onSuccess: (updated) => {
      setFlags({ verified: !!updated.verified, directory_hidden: !!updated.directory_hidden });
      done("Directory settings saved");
    },
    onError,
  });

  const data = referrals.data;
  return (
    <Drawer
      title={`Referrals & directory · ${partner.display_name}`}
      subtitle={data ? `Referral code ${data.code}` : partner.id}
      width={760}
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Card variant="outlined" title="Public directory">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {partner.directory_listed
              ? "The partner opted in to the Hire an expert directory."
              : "The partner has not opted in; the flags apply once they do."}
          </p>
          <div className="ak-cell-line">
            <Button
              size="sm"
              variant={flags.verified ? "outline" : "primary"}
              icon="check"
              loading={directory.isPending}
              onClick={() => directory.mutate({ verified: !flags.verified })}
            >
              {flags.verified ? "Revoke Verified" : "Grant Verified"}
            </Button>
            <Button
              size="sm"
              variant={flags.directory_hidden ? "primary" : "danger-outline"}
              icon="slash"
              loading={directory.isPending}
              onClick={() => directory.mutate({ directory_hidden: !flags.directory_hidden })}
            >
              {flags.directory_hidden ? "Show profile" : "Hide profile"}
            </Button>
          </div>
        </div>
      </Card>

      <Card variant="outlined" title="Referral terms">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The partner earns this share of each referred merchant's plan payments, for this many months after the
            merchant's first paid invoice. Applies to payments from now on.
          </p>
          <div className="ak-2col">
            <FormField label="Share (%)" htmlFor="ref-pct" hint="Default 20">
              <Input id="ref-pct" dir="ltr" numeric inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
            </FormField>
            <FormField label="Months" htmlFor="ref-months" hint="Default 12">
              <Input
                id="ref-months"
                dir="ltr"
                numeric
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </FormField>
          </div>
          <Button size="sm" variant="primary" disabled={!termsOk} loading={terms.isPending} onClick={() => terms.mutate()}>
            Save terms
          </Button>
        </div>
      </Card>

      <Card variant="outlined" title="Attribute a store">
        <div className="space-y-3">
          <FormField label="Store subdomain" htmlFor="ref-subdomain" hint="Replaces the store's current referrer, if any.">
            <Input id="ref-subdomain" dir="ltr" mono value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
          </FormField>
          <Button
            size="sm"
            variant="outline"
            disabled={!subdomain.trim()}
            loading={assign.isPending}
            onClick={() => assign.mutate()}
          >
            Attribute
          </Button>
        </div>
      </Card>

      {referrals.isError ? (
        <EmptyState
          kind="error"
          title="Referrals failed to load"
          body={referrals.error instanceof Error ? referrals.error.message : "The request did not complete."}
        />
      ) : null}
      <DataTable
        dense
        caption="Referred stores, newest first"
        columns={[
          ...REFERRAL_COLUMNS,
          {
            key: "tenant_id",
            header: "",
            align: "end",
            render: (r) => (
              <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(r.tenant_id)}>
                Detach
              </Button>
            ),
          },
        ]}
        rows={data?.stores ?? []}
        rowKey={(r) => r.tenant_id}
        loading={referrals.isLoading}
        empty={<EmptyState kind="empty" icon="inbox" title="No referred stores" body="Stores that sign up with this partner's link appear here." />}
      />
    </Drawer>
  );
}

function PartnerCard({
  partner,
  busy,
  onApprove,
  onReinstate,
  onNote,
  onLedger,
  onReferrals,
}: {
  partner: AdminPartner;
  busy: boolean;
  onApprove: () => void;
  onReinstate: () => void;
  onNote: (kind: "reject" | "suspend") => void;
  onLedger: () => void;
  onReferrals: () => void;
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
    {
      label: "Directory",
      value: `${partner.directory_listed ? "Listed" : "Not listed"}${partner.verified ? " · Verified" : ""}${
        partner.directory_hidden ? " · Hidden by NUMU" : ""
      }`,
    },
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
          {partner.status === "approved" || partner.status === "suspended" ? (
            <>
              <Button size="sm" variant="subtle" icon="banknote" onClick={onLedger}>
                Ledger
              </Button>
              <Button size="sm" variant="subtle" icon="users" onClick={onReferrals}>
                Referrals &amp; directory
              </Button>
            </>
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
  const [ledgerFor, setLedgerFor] = useState<AdminPartner | null>(null);
  const [referralsFor, setReferralsFor] = useState<AdminPartner | null>(null);

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
      <div className="ak-2col">
        <ProgramSwitch />
        <BillingSwitch />
      </div>

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
            onLedger={() => setLedgerFor(p)}
            onReferrals={() => setReferralsFor(p)}
          />
        ))}
      </div>

      {ledgerFor ? <LedgerDrawer partner={ledgerFor} onClose={() => setLedgerFor(null)} /> : null}
      {referralsFor ? <ReferralsDrawer partner={referralsFor} onClose={() => setReferralsFor(null)} /> : null}

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
