/**
 * WhatsApp — the access queue and the sending identity behind it.
 *
 * Merchants ask for permission to send WhatsApp notifications; an operator
 * works this queue. Per request, depending on where it sits in the FSM:
 *
 *   pending  → approve, or reject with a reason
 *   approved → disable
 *   rejected → approve after all
 *   disabled → enable again
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
} from "@/ds";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  listWhatsappAccessRequests,
  whatsappAccessActions,
  type AdminWhatsAppAccessItem,
  type WhatsappAccessAction,
  type WhatsappAccessStatus,
  type WhatsappAccessStatusFilter,
} from "@/services/whatsappAccessApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_FILTERS: { value: WhatsappAccessStatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
  { value: "all", label: "All" },
];

/** The platform's status vocabulary, so the same word never renders twice. */
const STATUS: Record<WhatsappAccessStatus, "pending" | "active" | "failed" | "archived"> = {
  pending: "pending",
  approved: "active",
  rejected: "failed",
  disabled: "archived",
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
  pending: boolean;
}

function AccessRequestCard({ item, onAct, pending }: CardProps) {
  const [dialog, setDialog] = useState<null | "reject" | "disable">(null);
  const [notes, setNotes] = useState("");

  const handle = item.store_subdomain ?? item.store_slug ?? null;
  const noteRequired = dialog === "reject";
  const canSubmit = !noteRequired || notes.trim().length > 0;

  const facts: KeyValueItem[] = [
    { label: "Requested", value: formatDateTime(item.created_at), mono: true },
    { label: "Expected volume", value: item.expected_volume ?? "—" },
    { label: "Contact", value: item.contact_phone ?? "—", mono: true },
    { label: "Requester", value: item.requester_email ?? "—", mono: true },
  ];

  return (
    <Card
      title={item.store_name ?? "Unnamed store"}
      subtitle={handle ?? undefined}
      actions={<StatusBadge status={STATUS[item.status]} />}
      footer={
        <div className="ak-cell-line">
          {item.status === "pending" ? (
            <>
              <Button
                size="sm"
                icon="check"
                loading={pending}
                onClick={() => onAct("approve")}
              >
                Approve
              </Button>
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
            </>
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

          {item.status === "rejected" ? (
            <Button size="sm" icon="check" loading={pending} onClick={() => onAct("approve")}>
              Approve after all
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

export default function WhatsappAccessRequests() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] =
    useState<WhatsappAccessStatusFilter>("pending");
  const [actingId, setActingId] = useState<string | null>(null);

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

  const countFor = (value: WhatsappAccessStatusFilter): number | undefined => {
    if (!counts) return undefined;
    if (value === "all") {
      return counts.pending + counts.approved + counts.rejected + counts.disabled;
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
            body={`No ${statusFilter === "all" ? "" : `${statusFilter} `}access requests right now.`}
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
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
