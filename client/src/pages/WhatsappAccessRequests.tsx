/**
 * WhatsApp — the access queue and the sending identity behind it.
 *
 * Merchants ask for permission to send WhatsApp notifications; an operator
 * works this queue. Every template message costs the platform money, so
 * access is sold: pricing a request opens an InstaPay payment, the merchant
 * uploads the receipt, and approving it in Subscription payments switches
 * the channel on for one period. Per request, depending on where it sits in
 * the FSM:
 *
 *   pending          → price, approve free, or reject with a reason
 *   awaiting_payment → price again, or reject
 *   approved         → price the next period, or disable
 *   expired          → price again, or approve free
 *   rejected         → price, or approve free after all
 *   disabled         → enable again
 *
 * Rejecting and disabling both take an operator note. Rejection requires
 * one — "Invalid input" is not a reason a merchant can act on, and the note
 * is what they eventually see. The queue refetches every 30 seconds so a
 * request that arrives while the page is open does not sit unseen.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { DeviceHealthTable } from "@/components/whatsapp/DeviceHealthTable";
import { MessageLogTable } from "@/components/whatsapp/MessageLogTable";
import { PairMerchantNumber } from "@/components/whatsapp/PairMerchantNumber";
import { PlatformDeviceCard } from "@/components/whatsapp/PlatformDeviceCard";
import { TransportAssignment } from "@/components/whatsapp/TransportAssignment";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  type KeyValueItem,
  type StatusBadgeProps,
} from "@/ds";
import { formatDateTime, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import {
  listWhatsappAccessRequests,
  priceWhatsappAccessRequest,
  whatsappAccessActions,
  type AdminWhatsAppAccessItem,
  type WhatsappAccessAction,
  type WhatsappAccessPriceResponse,
  type WhatsappAccessStatus,
  type WhatsappAccessStatusFilter,
  type WhatsappBillingCycle,
} from "@/services/whatsappAccessApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_FILTERS: { value: WhatsappAccessStatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "approved", label: "Approved" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
  { value: "all", label: "All" },
];

/** The platform's status vocabulary, so the same word never renders twice. */
const STATUS: Record<
  WhatsappAccessStatus,
  { status: StatusBadgeProps["status"]; label?: string }
> = {
  pending: { status: "pending" },
  awaiting_payment: { status: "pending", label: "Awaiting payment" },
  approved: { status: "active" },
  expired: { status: "suspended", label: "Expired" },
  rejected: { status: "failed" },
  disabled: { status: "archived" },
};

const CYCLES: { value: WhatsappBillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const CYCLE_UNIT: Record<WhatsappBillingCycle, string> = {
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

const ACTION_VERB: Record<WhatsappAccessAction, string> = {
  approve: "approved",
  reject: "rejected",
  disable: "disabled",
  enable: "enabled",
};

interface CardProps {
  item: AdminWhatsAppAccessItem;
  onAct: (action: WhatsappAccessAction, notes?: string) => void;
  onPrice: () => void;
  pending: boolean;
}

function AccessRequestCard({ item, onAct, onPrice, pending }: CardProps) {
  const [dialog, setDialog] = useState<null | "reject" | "disable">(null);
  const [notes, setNotes] = useState("");

  const handle = item.store_subdomain ?? item.store_slug ?? null;
  const noteRequired = dialog === "reject";
  const canSubmit = !noteRequired || notes.trim().length > 0;

  const lapsed =
    item.status === "approved" &&
    item.active_until != null &&
    new Date(item.active_until).getTime() <= Date.now();
  const allowance = item.message_allowance;
  const used = item.messages_used;
  const usage = used != null && allowance != null ? (allowance > 0 ? used / allowance : 1) : null;

  let alert = null;
  if (lapsed) {
    alert = (
      <Badge tone="danger" icon="alertTriangle" square>
        Lapsed
      </Badge>
    );
  } else if (usage != null && usage >= 1) {
    alert = (
      <Badge tone="danger" icon="alertTriangle" square>
        Allowance used up
      </Badge>
    );
  } else if (usage != null && usage >= 0.8) {
    alert = (
      <Badge tone="warning" icon="alertTriangle" square>
        {Math.floor(usage * 100)}% used
      </Badge>
    );
  }

  const facts: KeyValueItem[] = [
    {
      label: "Price",
      value:
        item.amount_cents != null
          ? `${formatMoney(item.amount_cents, item.currency ?? "EGP")} / ${CYCLE_UNIT[item.billing_cycle ?? "monthly"]}`
          : "Not priced",
      mono: true,
    },
  ];
  if (item.status === "approved" || item.active_until) {
    facts.push({
      label: "Active until",
      value: item.active_until ? formatDateTime(item.active_until) : "No expiry",
      mono: true,
    });
  }
  if (used != null) {
    facts.push({
      label: "Messages this period",
      value: `${formatNumber(used)} / ${allowance == null ? "unlimited" : formatNumber(allowance)}`,
      mono: true,
    });
  }
  facts.push(
    { label: "Requested", value: formatDateTime(item.created_at), mono: true },
    { label: "Expected volume", value: item.expected_volume ?? "—" },
    { label: "Contact", value: item.contact_phone ?? "—", mono: true },
    { label: "Requester", value: item.requester_email ?? "—", mono: true },
  );

  return (
    <Card
      title={item.store_name ?? "Unnamed store"}
      subtitle={handle ?? undefined}
      actions={
        <div className="ak-cell-line">
          {alert}
          <StatusBadge {...STATUS[item.status]} />
        </div>
      }
      footer={
        <div className="ak-cell-line">
          {item.status !== "disabled" ? (
            <Button
              size="sm"
              variant={item.status === "pending" || item.status === "expired" ? "primary" : "outline"}
              icon="banknote"
              disabled={pending}
              onClick={onPrice}
            >
              Price
            </Button>
          ) : null}

          {item.status === "pending" || item.status === "expired" || item.status === "rejected" ? (
            <Button
              size="sm"
              variant="outline"
              icon="check"
              loading={pending}
              onClick={() => onAct("approve")}
            >
              Approve free
            </Button>
          ) : null}

          {item.status === "pending" || item.status === "awaiting_payment" ? (
            <Button
              size="sm"
              variant="danger-outline"
              icon="x"
              disabled={pending}
              onClick={() => {
                setDialog("reject");
                setNotes("");
              }}
            >
              Reject
            </Button>
          ) : null}

          {item.status === "approved" ? (
            <Button
              size="sm"
              variant="danger-outline"
              icon="slash"
              loading={pending}
              onClick={() => {
                setDialog("disable");
                setNotes("");
              }}
            >
              Disable
            </Button>
          ) : null}

          {item.status === "disabled" ? (
            <Button
              size="sm"
              icon="playCircle"
              loading={pending}
              onClick={() => onAct("enable")}
            >
              Enable
            </Button>
          ) : null}
        </div>
      }
    >
      {/* The card body has no gap of its own, so the stack owns the rhythm. */}
      <div className="ak-stack">
        {item.note ? (
          <div className="ak-note">
            <p className="numu-label">Merchant note</p>
            <p>{item.note}</p>
          </div>
        ) : null}

        <KeyValue items={facts} />

        {item.reviewed_at ? (
          <div className="ak-note">
            <p className="numu-label">
              Reviewed {formatRelative(item.reviewed_at)}
              {item.reviewer_user_id ? ` · ${item.reviewer_user_id}` : ""}
            </p>
            {item.review_reason ? <p>{item.review_reason}</p> : null}
          </div>
        ) : null}

        {/* Only meaningful once access is granted: Meta Cloud versus GOWA, and
            for GOWA whether the store rides the shared number or pairs its own. */}
        {item.status === "approved" ? (
          <TransportAssignment storeId={item.store_id} storeName={item.store_name} />
        ) : null}
      </div>

      <Dialog
        open={dialog !== null}
        tone={dialog === "reject" ? "danger" : "warning"}
        title={dialog === "reject" ? "Reject this request?" : "Disable WhatsApp access?"}
        description={
          dialog === "reject"
            ? "The store is not granted access. The reason is kept on the request and shown in the audit trail."
            : "The store stops sending immediately. You can re-enable it from this queue at any time."
        }
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!canSubmit}
              onClick={() => {
                if (!dialog) return;
                onAct(dialog, notes.trim() || undefined);
                setDialog(null);
              }}
            >
              {dialog === "reject" ? "Reject request" : "Disable access"}
            </Button>
          </>
        }
      >
        <FormField
          label={dialog === "reject" ? "Reason" : "Notes"}
          required={noteRequired}
          htmlFor="wa-access-notes"
          hint={
            dialog === "reject"
              ? "Say what would make this request approvable."
              : "Optional context for the audit trail."
          }
        >
          <Textarea
            id="wa-access-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              dialog === "reject"
                ? "e.g. Business number is not verified with Meta yet."
                : "e.g. Merchant asked to pause while they migrate numbers."
            }
          />
        </FormField>
      </Dialog>
    </Card>
  );
}

interface PriceDialogProps {
  item: AdminWhatsAppAccessItem;
  onClose: () => void;
}

function PriceDialog({ item, onClose }: PriceDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(
    item.amount_cents != null ? String(item.amount_cents / 100) : "",
  );
  const [cycle, setCycle] = useState<WhatsappBillingCycle>(item.billing_cycle ?? "monthly");
  const [allowance, setAllowance] = useState(
    item.message_allowance != null ? String(item.message_allowance) : "",
  );
  const [notes, setNotes] = useState("");
  const [bill, setBill] = useState<WhatsappAccessPriceResponse | null>(null);

  const piasters = Math.round(Number(amount) * 100);
  const amountValid = amount.trim() !== "" && Number.isFinite(piasters) && piasters > 0;
  const allowanceValid = allowance.trim() === "" || /^\d+$/.test(allowance.trim());

  const renewal =
    item.status === "approved" &&
    item.active_until != null &&
    new Date(item.active_until).getTime() > Date.now();
  const cutsOff = item.status === "approved" && item.active_until == null;

  const price = useMutation({
    mutationFn: () =>
      priceWhatsappAccessRequest(item.id, {
        amount_cents: piasters,
        billing_cycle: cycle,
        message_allowance: allowance.trim() === "" ? null : Number(allowance.trim()),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (result) => {
      setBill(result);
      toast.success(`${item.store_name ?? "Request"} priced`, {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-access-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "queues"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  if (bill) {
    return (
      <Dialog
        open
        icon="banknote"
        title="Payment opened"
        description="The merchant transfers this amount with the reference in the transfer note, then uploads the receipt. Approving it in Subscription payments switches access on."
        onClose={onClose}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <KeyValue
          items={[
            { label: "Reference", value: bill.special_reference, mono: true },
            { label: "Pay to", value: bill.destination ?? "—", mono: true },
            { label: "Amount", value: formatMoney(bill.amount_cents, bill.currency), mono: true },
          ]}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      tone={cutsOff ? "warning" : "neutral"}
      icon="banknote"
      title={`Price WhatsApp for ${item.store_name ?? "this store"}`}
      description={
        renewal
          ? "A renewal. The store keeps sending while this bill is open, and payment extends its current period."
          : cutsOff
            ? "This store sends on a free grant today. Pricing it moves the request to awaiting payment, and sending stops until the merchant's receipt is approved."
            : "The request moves to awaiting payment. Access switches on for one period once the merchant's receipt is approved."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={price.isPending}
            disabled={!amountValid || !allowanceValid}
            onClick={() => price.mutate()}
          >
            Open payment
          </Button>
        </>
      }
    >
      <div className="ak-stack">
        <FormField label="Amount" required htmlFor="wa-price-amount" hint="Price for one period.">
          <Input
            id="wa-price-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            affix="EGP"
            numeric
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
          />
        </FormField>
        <FormField label="Billing cycle" htmlFor="wa-price-cycle">
          <Select
            id="wa-price-cycle"
            value={cycle}
            onChange={(e) => setCycle(e.target.value as WhatsappBillingCycle)}
            options={CYCLES}
          />
        </FormField>
        <FormField
          label="Message allowance"
          htmlFor="wa-price-allowance"
          hint="Template messages per period. Leave blank for unlimited."
          error={allowanceValid ? undefined : "A whole number, 0 or more."}
        >
          <Input
            id="wa-price-allowance"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            numeric
            error={!allowanceValid}
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            placeholder="Unlimited"
          />
        </FormField>
        <FormField label="Notes" htmlFor="wa-price-notes" hint="Optional context for the audit trail.">
          <Textarea
            id="wa-price-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Agreed on a call: 2,000 messages a month."
          />
        </FormField>
      </div>
    </Dialog>
  );
}

export default function WhatsappAccessRequests() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] =
    useState<WhatsappAccessStatusFilter>("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<AdminWhatsAppAccessItem | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["whatsapp-access-requests", statusFilter],
    queryFn: () => listWhatsappAccessRequests(statusFilter),
    refetchInterval: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      notes,
    }: {
      id: string;
      action: WhatsappAccessAction;
      notes?: string;
    }) => whatsappAccessActions[action](id, notes),
    onMutate: ({ id }) => setActingId(id),
    onSettled: () => setActingId(null),
    onSuccess: (updated, { action }) => {
      toast.success(`${updated.store_name ?? "Request"} ${ACTION_VERB[action]}`, {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-access-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "queues"] });
    },
    onError: (err: unknown) => {
      // A 409 (illegal transition) or any 4xx arrives as an Error whose
      // message is the backend `detail` string — surface it verbatim.
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const requests = requestsQuery.data?.requests ?? [];
  const counts = requestsQuery.data?.counts;
  const filterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase();

  const countFor = (value: WhatsappAccessStatusFilter): number | undefined => {
    if (!counts) return undefined;
    if (value === "all") {
      return Object.values(counts).reduce((sum, n) => sum + n, 0);
    }
    return counts[value];
  };

  return (
    <DashboardLayout
      title="WhatsApp"
      subtitle="Access requests, and how each approved store sends."
      actions={
        <Button
          variant="subtle"
          icon="refresh"
          loading={requestsQuery.isFetching}
          onClick={() => void requestsQuery.refetch()}
        >
          Refresh
        </Button>
      }
      tabs={
        <Tabs
          tabs={STATUS_FILTERS.map((f) => ({
            id: f.value,
            label: f.label,
            count: countFor(f.value),
          }))}
          active={statusFilter}
          onChange={(id) => setStatusFilter(id as WhatsappAccessStatusFilter)}
        />
      }
    >
      {/* The sending identity every merchant on the shared number depends on.
          Above the queue because if this session drops, they all stop sending. */}
      <PlatformDeviceCard />

      {/* Fleet health next: a dead session is this transport's normal failure
          mode, and it should be visible here rather than discovered when a
          merchant reports that messages stopped. */}
      <DeviceHealthTable />

      {/* Pair without first hunting for the merchant's row below. */}
      <PairMerchantNumber
        stores={(requestsQuery.data?.requests ?? [])
          .filter((r) => r.status === "approved" && r.store_id)
          .map((r) => ({
            id: r.store_id,
            name: r.store_name ?? r.store_subdomain ?? r.store_id,
          }))}
      />

      {/* "Did it actually go out, and what did WhatsApp say" — the first
          question in most support conversations. */}
      <MessageLogTable />

      {requestsQuery.isError ? (
        <Card>
          <EmptyState
            kind="error"
            title="Access requests failed to load"
            body={
              requestsQuery.error instanceof Error
                ? requestsQuery.error.message
                : "The request did not complete."
            }
            action={
              <Button size="sm" onClick={() => void requestsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {requestsQuery.isLoading ? (
        <div className="ak-2col">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={220} variant="block" />
          ))}
        </div>
      ) : null}

      {!requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0 ? (
        <Card>
          <EmptyState
            kind={statusFilter === "pending" ? "empty" : "noResults"}
            icon="inbox"
            title={statusFilter === "pending" ? "Queue is clear" : "Nothing here"}
            body={`No ${statusFilter === "all" ? "" : `${filterLabel} `}access requests right now.`}
          />
        </Card>
      ) : null}

      <div className="ak-2col">
        {requests.map((item) => (
          <AccessRequestCard
            key={item.id}
            item={item}
            pending={actionMutation.isPending && actingId === item.id}
            onAct={(action, notes) =>
              actionMutation.mutate({ id: item.id, action, notes })
            }
            onPrice={() => setPricing(item)}
          />
        ))}
      </div>

      {/* Page-level, not per card: pricing moves the row out of the tab it was
          opened from, and the payment reference must outlive that refetch. */}
      {pricing ? <PriceDialog item={pricing} onClose={() => setPricing(null)} /> : null}
    </DashboardLayout>
  );
}
