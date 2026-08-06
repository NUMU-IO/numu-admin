/**
 * WhatsappAccessRequests — admin queue for WhatsApp-notification access.
 *
 * Merchants request permission to turn on WhatsApp notifications; this
 * page is where a super-admin works the queue. For each request the
 * admin can, depending on its current status:
 *
 *   - pending  → **Approve** or **Reject** (reject captures a reason).
 *   - approved → **Disable** (with optional notes).
 *   - rejected → **Approve** (re-consider and grant).
 *   - disabled → **Enable** (switch access back on).
 *
 * A status filter (defaulting to the pending queue) narrows the list;
 * the tab labels carry the global per-status counts. The list refetches
 * every 30s so the queue stays warm without manual reloads.
 *
 * Cloned from MarketplaceReview.tsx — same card / dialog / react-query
 * shape, same per-row `actingId` in-flight tracking.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLoginUrl } from "@/const";
import {
  listWhatsappAccessRequests,
  whatsappAccessActions,
  type AdminWhatsAppAccessItem,
  type WhatsappAccessAction,
  type WhatsappAccessStatus,
  type WhatsappAccessStatusFilter,
} from "@/services/whatsappAccessApi";
import {
  Ban,
  Building2,
  Check,
  Clock,
  Gauge,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Power,
  RefreshCw,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Static config ───────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: WhatsappAccessStatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
  { value: "all", label: "All" },
];

const STATUS_BADGE: Record<
  WhatsappAccessStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    className:
      "border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
  disabled: {
    label: "Disabled",
    className: "border-transparent bg-muted text-muted-foreground",
  },
};

// ─── Per-request card ────────────────────────────────────────────────────────

interface AccessRequestCardProps {
  item: AdminWhatsAppAccessItem;
  onAct: (action: WhatsappAccessAction, notes?: string) => void;
  pending: boolean;
}

function AccessRequestCard({ item, onAct, pending }: AccessRequestCardProps) {
  const [dialog, setDialog] = useState<null | "reject" | "disable">(null);
  const [notes, setNotes] = useState("");

  const createdAt = new Date(item.created_at);
  const reviewedAt = item.reviewed_at ? new Date(item.reviewed_at) : null;
  const badge = STATUS_BADGE[item.status];

  const storeLabel = item.store_name ?? "Unnamed store";
  const storeHandle = item.store_subdomain ?? item.store_slug ?? null;

  // Reject needs a reason (mirrors the marketplace reject flow); the
  // disable dialog's notes are optional.
  const noteRequired = dialog === "reject";
  const canSubmit = !noteRequired || notes.trim().length > 0;

  function openDialog(action: "reject" | "disable") {
    setDialog(action);
    setNotes("");
  }

  function commit() {
    if (!dialog) return;
    onAct(dialog, notes.trim() || undefined);
    setDialog(null);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{storeLabel}</span>
              {storeHandle && (
                <Badge variant="outline" className="shrink-0 font-normal">
                  {storeHandle}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {item.requester_email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  <a
                    href={`mailto:${item.requester_email}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {item.requester_email}
                  </a>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {createdAt.toLocaleString()}
              </span>
            </CardDescription>
          </div>
          <Badge className={`shrink-0 ${badge.className}`}>{badge.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {item.note && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Merchant note
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {item.note}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Volume:</span>
            <span className="truncate">{item.expected_volume ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Contact:</span>
            {item.contact_phone ? (
              <a
                href={`tel:${item.contact_phone}`}
                className="truncate underline-offset-2 hover:underline"
              >
                {item.contact_phone}
              </a>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        {reviewedAt && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>
                Reviewed {reviewedAt.toLocaleString()}
                {item.reviewer_user_id && (
                  <span className="text-muted-foreground/80">
                    {" · by "}
                    {item.reviewer_user_id}
                  </span>
                )}
              </span>
            </p>
            {item.review_reason && (
              <p className="whitespace-pre-line">{item.review_reason}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {item.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={() => onAct("approve")}
                disabled={pending}
                className="bg-green-600 hover:bg-green-700"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 me-1.5" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => openDialog("reject")}
                disabled={pending}
              >
                <X className="h-3.5 w-3.5 me-1.5" />
                Reject
              </Button>
            </>
          )}

          {item.status === "approved" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openDialog("disable")}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Ban className="h-3.5 w-3.5 me-1.5" />
              )}
              Disable
            </Button>
          )}

          {item.status === "rejected" && (
            <Button
              size="sm"
              onClick={() => onAct("approve")}
              disabled={pending}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 me-1.5" />
              )}
              Approve
            </Button>
          )}

          {item.status === "disabled" && (
            <Button
              size="sm"
              onClick={() => onAct("enable")}
              disabled={pending}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Power className="h-3.5 w-3.5 me-1.5" />
              )}
              Enable
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "reject"
                ? "Reject this request"
                : "Disable WhatsApp access"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "reject"
                ? "The store won't be granted WhatsApp access. Add a reason — it's kept on the request for the audit trail."
                : "WhatsApp access will be switched off for this store. You can re-enable it later from this queue."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="wa-access-notes">
              {dialog === "reject" ? "Reason" : "Notes (optional)"}
            </label>
            <Textarea
              id="wa-access-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={
                dialog === "reject"
                  ? "Why is this request being rejected?"
                  : "Optional context for disabling access."
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={commit}
              disabled={!canSubmit}
            >
              {dialog === "reject" ? "Reject" : "Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WhatsappAccessRequests() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] =
    useState<WhatsappAccessStatusFilter>("pending");
  const [actingId, setActingId] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["whatsapp-access-requests", statusFilter],
    queryFn: () => listWhatsappAccessRequests(statusFilter),
    // 30s refetch so the queue stays warm without manual reloads —
    // requests trickle in as merchants opt into WhatsApp.
    refetchInterval: 30 * 1000,
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
      const verb =
        action === "approve"
          ? "approved"
          : action === "reject"
            ? "rejected"
            : action === "disable"
              ? "disabled"
              : "enabled";
      toast.success(`${updated.store_name ?? "Request"} ${verb}`);
      void queryClient.invalidateQueries({
        queryKey: ["whatsapp-access-requests"],
      });
    },
    onError: (err: unknown) => {
      // A 409 (illegal transition) or any 4xx arrives as an Error whose
      // message is the backend `detail` string — surface it verbatim.
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Action failed: ${msg}`);
    },
  });

  if (authLoading) return <DashboardLayoutSkeleton />;
  if (!user) {
    const target = getLoginUrl();
    if (target) window.location.href = target;
    return null;
  }

  const requests = requestsQuery.data?.requests ?? [];
  const counts = requestsQuery.data?.counts;

  const countFor = (value: WhatsappAccessStatusFilter): number | null => {
    if (!counts) return null;
    if (value === "all") {
      return (
        counts.pending + counts.approved + counts.rejected + counts.disabled
      );
    }
    return counts[value];
  };

  return (
    <DashboardLayout title="WhatsApp access">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              WhatsApp access requests
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Approve or reject merchant requests to switch on WhatsApp
              notifications. Approved stores can be disabled later; disabled or
              rejected stores can be re-approved from here.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void requestsQuery.refetch()}
            disabled={requestsQuery.isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 me-1.5${
                requestsQuery.isFetching ? " animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as WhatsappAccessStatusFilter)}
        >
          <TabsList>
            {STATUS_FILTERS.map((f) => {
              const c = countFor(f.value);
              return (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                  {c !== null && (
                    <span className="ms-1 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                      {c}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {requestsQuery.isError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Could not load access requests</p>
                <p className="text-muted-foreground mt-0.5">
                  {requestsQuery.error instanceof Error
                    ? requestsQuery.error.message
                    : "Unknown error"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {requestsQuery.isLoading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-56 animate-pulse bg-muted/30" />
            ))}
          </div>
        )}

        {!requestsQuery.isLoading && requests.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium">Nothing here</p>
              <p className="text-sm text-muted-foreground mt-1">
                No {statusFilter === "all" ? "" : `${statusFilter} `}access
                requests right now.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
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
      </div>
    </DashboardLayout>
  );
}
