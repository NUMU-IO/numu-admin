/**
 * MarketplaceReview — admin queue for marketplace theme moderation.
 *
 * Lists every version awaiting review. For each, the super-admin can:
 *
 *   - **Preview** the bundle in a sandboxed iframe (the bundle URL
 *     plus a query param so the BYOT boundary in the storefront knows
 *     to mount it on a sandbox demo store).
 *   - **Inspect** the source ZIP (link out).
 *   - **Approve** the version, publishing it to the public catalog.
 *   - **Reject** with required notes (developer sees the reason).
 *   - **Request changes** — version goes back to draft; developer
 *     can re-submit with edits.
 *
 * The approve endpoint requires MFA freshness (≤5 min). The page
 * surfaces a banner reminder so admins don't get a confusing 401
 * mid-review. The MFA flow itself is owned by the admin auth UI;
 * the banner just points at the right action.
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
import { getLoginUrl } from "@/const";
import {
  listPendingReviews,
  reviewVersion,
  type PendingThemeVersion,
  type ReviewDecision,
} from "@/services/marketplaceAdminApi";
import {
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  Download,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

// ─── Per-version card ───────────────────────────────────────────────────────

interface ReviewCardProps {
  version: PendingThemeVersion;
  onAct: (decision: ReviewDecision, notes?: string) => void;
  pending: boolean;
}

function ReviewCard({ version, onAct, pending }: ReviewCardProps) {
  const [dialog, setDialog] = useState<null | "reject" | "request_changes">(
    null,
  );
  const [notes, setNotes] = useState("");

  const submittedAt = new Date(version.submitted_at);

  function openWithDecision(d: "reject" | "request_changes") {
    setDialog(d);
    setNotes("");
  }

  function commitDecision() {
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
              <span className="truncate">{version.theme_name}</span>
              <Badge variant="secondary">v{version.version_string}</Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="font-medium">
                {version.developer_name ?? "Unknown developer"}
              </span>
              {version.developer_email && (
                <span className="text-muted-foreground">
                  {" "}
                  ·{" "}
                  <a
                    href={`mailto:${version.developer_email}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {version.developer_email}
                  </a>
                </span>
              )}
              <span className="text-muted-foreground">
                {" · submitted "}
                {submittedAt.toLocaleString()}
              </span>
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            {version.theme_slug}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {version.release_notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Release notes
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {version.release_notes}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {version.bundle_url && (
            <a
              href={version.bundle_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              bundle.js
            </a>
          )}
          {version.css_url && (
            <a
              href={version.css_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              theme.css
            </a>
          )}
          {version.source_zip_path && (
            <a
              href={version.source_zip_path}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 underline-offset-2 hover:underline col-span-2"
            >
              <Download className="h-3.5 w-3.5" />
              source.zip
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
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
            variant="outline"
            onClick={() => openWithDecision("request_changes")}
            disabled={pending}
          >
            <AlertTriangle className="h-3.5 w-3.5 me-1.5" />
            Request changes
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => openWithDecision("reject")}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5 me-1.5" />
            Reject
          </Button>
        </div>
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "reject"
                ? "Reject this version"
                : "Request changes"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "reject"
                ? "The developer will see your note. They cannot resubmit this version — they have to publish a new one."
                : "The developer will get an email with your note and the version moves back to draft. They can re-submit after editing."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="review-notes">
              Notes (visible to the developer)
            </label>
            <Textarea
              id="review-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={
                dialog === "reject"
                  ? "Reason for rejection — e.g. theme uses an unapproved third-party CDN."
                  : "What needs to change before approval?"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={dialog === "reject" ? "destructive" : "default"}
              onClick={commitDecision}
              disabled={notes.trim().length === 0}
            >
              {dialog === "reject" ? "Reject" : "Send change request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MarketplaceReview() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["marketplace-pending-reviews"],
    queryFn: listPendingReviews,
    // 30s refetch so the queue stays warm without manual reloads —
    // submissions trickle in throughout the day.
    refetchInterval: 30 * 1000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      versionId,
      decision,
      notes,
    }: {
      versionId: string;
      decision: ReviewDecision;
      notes?: string;
    }) => reviewVersion(versionId, { decision, notes }),
    onMutate: ({ versionId }) => setActingId(versionId),
    onSettled: () => setActingId(null),
    onSuccess: (data) => {
      const verb =
        data.decision === "approve"
          ? "approved"
          : data.decision === "reject"
            ? "rejected"
            : "sent back for changes";
      toast.success(`Version ${verb}`);
      void queryClient.invalidateQueries({
        queryKey: ["marketplace-pending-reviews"],
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // 401 with the 2FA gate phrasing is the most common error — give
      // a clearer hint than the raw API message.
      if (/2fa|mfa|step.up/i.test(msg)) {
        toast.error(
          "Re-verify MFA before approving. Open your profile → Security → Confirm MFA, then try again.",
        );
      } else {
        toast.error(`Review failed: ${msg}`);
      }
    },
  });

  if (authLoading) return <DashboardLayoutSkeleton />;
  if (!user) {
    const target = getLoginUrl();
    if (target) window.location.href = target;
    return null;
  }

  const pending = pendingQuery.data?.pending ?? [];

  return (
    <DashboardLayout title="Marketplace review">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Marketplace review
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Approve or reject theme versions before they reach the public
              catalog. Approval requires a fresh (≤5 min) MFA confirmation.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void pendingQuery.refetch()}
            disabled={pendingQuery.isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 me-1.5${
                pendingQuery.isFetching ? " animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        {pendingQuery.isError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Could not load pending reviews</p>
                <p className="text-muted-foreground mt-0.5">
                  {pendingQuery.error instanceof Error
                    ? pendingQuery.error.message
                    : "Unknown error"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {pendingQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-48 animate-pulse bg-muted/30" />
            ))}
          </div>
        )}

        {!pendingQuery.isLoading && pending.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium">Queue is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Nothing waiting for review right now.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {pending.map((v) => (
            <ReviewCard
              key={v.version_id}
              version={v}
              pending={reviewMutation.isPending && actingId === v.version_id}
              onAct={(decision, notes) =>
                reviewMutation.mutate({
                  versionId: v.version_id,
                  decision,
                  notes,
                })
              }
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
