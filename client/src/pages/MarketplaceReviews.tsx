/**
 * Marketplace Reviews — moderation queue for BYOT theme submissions.
 *
 * Lists every theme version in `pending_review` status. Admins can:
 *   - Inspect the version metadata (size, checksum, release notes,
 *     bundle URL → opens in a new tab so admins can verify the actual
 *     JS asset before approving).
 *   - Approve → publishes the version (and marks the listing
 *     `published` if it was still in `draft`).
 *   - Reject → records the rejection reason; the developer sees it on
 *     their submission's status page.
 *
 * Architecture note: this page only displays admin-cleared metadata —
 * the actual security scan + AST checks have already run on the build
 * worker, and the version wouldn't reach `pending_review` if it failed
 * those. We intentionally do NOT re-fetch and parse the bundle here;
 * trust is in the worker's report (build_log + checksum), not in
 * client-side code that an admin might be tempted to skip.
 */

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
import { Empty } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import {
  listPendingReviews,
  submitReviewDecision,
  type PendingReviewItem,
  type ReviewDecision,
} from "@/services/marketplaceAdminApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Download, ExternalLink, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface ReviewCardProps {
  item: PendingReviewItem;
  onDecision: (
    versionId: string,
    decision: ReviewDecision,
    notes: string,
  ) => void;
  pendingDecision: ReviewDecision | null;
}

function ReviewCard({ item, onDecision, pendingDecision }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");

  const submitting = pendingDecision !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <span className="truncate">
                {item.theme_name ?? item.theme_slug ?? "Untitled theme"}
              </span>
              <Badge variant="secondary">v{item.version_string}</Badge>
              <Badge variant="outline">
                <Clock className="w-3 h-3 mr-1" />
                {formatRelative(item.created_at)}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1 text-xs font-mono break-all">
              theme {item.theme_id} · version {item.version_id}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : "Review"}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6">
          {/* ── Marketing assets row — the visual the merchant will see ───── */}
          {(item.thumbnail_url || item.preview_url) && (
            <div>
              <SectionLabel>Marketing assets</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <AssetThumb
                  label="Thumbnail (catalog card)"
                  url={item.thumbnail_url}
                  ratio="aspect-video"
                />
                <AssetThumb
                  label="Preview (theme detail page)"
                  url={item.preview_url}
                  ratio="aspect-video"
                />
              </div>
            </div>
          )}

          {/* ── Listing metadata ─────────────────────────────────────────── */}
          <div>
            <SectionLabel>Listing</SectionLabel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Slug">
                <code className="text-xs">{item.theme_slug ?? "—"}</code>
              </Field>
              <Field label="Status">
                <Badge variant="outline">{item.theme_status ?? "—"}</Badge>
              </Field>
              <Field label="Price">
                {item.price_cents > 0
                  ? `${(item.price_cents / 100).toFixed(2)} ${item.currency}`
                  : "Free"}
              </Field>
              <Field label="Category">
                {item.theme_category ?? "—"}
              </Field>
              <Field label="Languages">
                {item.theme_supported_languages.length > 0
                  ? item.theme_supported_languages.join(", ")
                  : "—"}
              </Field>
              <Field label="Tags">
                {item.theme_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.theme_tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </Field>
              {item.demo_store_url && (
                <Field label="Demo store" className="col-span-2">
                  <a
                    href={item.demo_store_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline-offset-2 hover:underline inline-flex items-center gap-1"
                  >
                    {item.demo_store_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Field>
              )}
              {item.theme_description && (
                <Field label="Description" className="col-span-2">
                  <div className="text-xs whitespace-pre-wrap leading-relaxed">
                    {item.theme_description}
                  </div>
                </Field>
              )}
            </div>
          </div>

          {/* ── Developer profile — trust signal ─────────────────────────── */}
          <div>
            <SectionLabel>Developer</SectionLabel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Name">{item.developer_name ?? "—"}</Field>
              <Field label="Email">
                <code className="text-xs break-all">
                  {item.developer_email ?? "—"}
                </code>
              </Field>
              <Field label="User ID">
                <code className="text-xs break-all">
                  {item.developer_id ?? "—"}
                </code>
              </Field>
              <Field label="Theme history">
                <span>
                  <strong>{item.developer_published_themes}</strong> published
                  {" / "}
                  <strong>{item.developer_total_themes}</strong> total
                </span>
                {item.developer_total_themes === 1 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    First-time submitter
                  </Badge>
                )}
              </Field>
            </div>
          </div>

          {/* ── Build artifacts ──────────────────────────────────────────── */}
          <div>
            <SectionLabel>Build artifacts</SectionLabel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Bundle size">
                <code>{formatBytes(item.size_bytes)}</code>
              </Field>
              <Field label="Submitted">
                {formatRelative(item.created_at)}
              </Field>
              <Field label="Checksum (SHA-256)" className="col-span-2">
                <code className="text-xs break-all">
                  {item.checksum ?? "—"}
                </code>
              </Field>
              {item.bundle_url && (
                <Field label="Bundle URL" className="col-span-2">
                  <a
                    href={item.bundle_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono break-all underline-offset-2 hover:underline inline-flex items-center gap-1"
                  >
                    {item.bundle_url}
                    <Download className="h-3 w-3 shrink-0" />
                  </a>
                </Field>
              )}
              {item.css_url && (
                <Field label="CSS URL" className="col-span-2">
                  <a
                    href={item.css_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono break-all underline-offset-2 hover:underline inline-flex items-center gap-1"
                  >
                    {item.css_url}
                    <Download className="h-3 w-3 shrink-0" />
                  </a>
                </Field>
              )}
            </div>
          </div>

          {/* ── Release notes ────────────────────────────────────────────── */}
          {item.release_notes && (
            <div>
              <SectionLabel>Release notes</SectionLabel>
              <div className="text-sm whitespace-pre-wrap rounded border bg-muted/30 p-3">
                {item.release_notes}
              </div>
            </div>
          )}

          {/* ── Build log (collapsible) ──────────────────────────────────── */}
          {item.build_log && (
            <CollapsibleSection
              title="Build log"
              defaultOpen={false}
            >
              <pre className="text-[11px] whitespace-pre-wrap rounded border bg-muted/30 p-3 max-h-64 overflow-auto font-mono">
                {item.build_log}
              </pre>
            </CollapsibleSection>
          )}

          {/* ── Schemas (collapsible) ────────────────────────────────────── */}
          <CollapsibleSection
            title={`Settings schema (${schemaCount(item.settings_schema)} setting${schemaCount(item.settings_schema) === 1 ? "" : "s"})`}
            defaultOpen={false}
          >
            <pre className="text-[11px] whitespace-pre-wrap rounded border bg-muted/30 p-3 max-h-64 overflow-auto font-mono">
              {JSON.stringify(item.settings_schema ?? {}, null, 2)}
            </pre>
          </CollapsibleSection>

          <CollapsibleSection
            title={`Section schemas (${schemaCount(item.section_schemas)} section${schemaCount(item.section_schemas) === 1 ? "" : "s"})`}
            defaultOpen={false}
          >
            <pre className="text-[11px] whitespace-pre-wrap rounded border bg-muted/30 p-3 max-h-64 overflow-auto font-mono">
              {JSON.stringify(item.section_schemas ?? {}, null, 2)}
            </pre>
          </CollapsibleSection>

          {/* ── Version history ──────────────────────────────────────────── */}
          {item.version_history.length > 1 && (
            <div>
              <SectionLabel>
                Version history ({item.version_history.length})
              </SectionLabel>
              <div className="rounded border divide-y">
                {item.version_history.map((h) => (
                  <div
                    key={h.version_id}
                    className={
                      "flex items-center justify-between gap-3 px-3 py-2 text-xs " +
                      (h.is_current ? "bg-primary/5" : "")
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="font-mono">{h.version_string}</code>
                      <Badge variant="outline" className="text-[10px]">
                        {h.status}
                      </Badge>
                      {h.is_current && (
                        <Badge variant="secondary" className="text-[10px]">
                          this submission
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground shrink-0">
                      {formatBytes(h.size_bytes)} · {formatRelative(h.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Decision ─────────────────────────────────────────────────── */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor={`notes-${item.version_id}`}>
              Reviewer notes (required for reject; optional for approve)
            </Label>
            <Textarea
              id={`notes-${item.version_id}`}
              placeholder="Anything you want the developer to see..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={submitting}
            />
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={submitting || !notes.trim()}
                // Reject requires notes — the developer needs to know why.
                onClick={() => onDecision(item.version_id, "reject", notes)}
              >
                {pendingDecision === "reject" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                disabled={submitting}
                onClick={() => onDecision(item.version_id, "approve", notes)}
              >
                {pendingDecision === "approve" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve & publish
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Helpers (small UI atoms used inside the card) ─────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function AssetThumb({
  label,
  url,
  ratio,
}: {
  label: string;
  url: string | null;
  ratio: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </div>
      <div
        className={
          "relative w-full overflow-hidden rounded border bg-muted/30 " + ratio
        }
      >
        {url ? (
          <img
            src={url}
            alt={label}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            (none provided)
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{open ? "▼" : "▶"}</span>
        {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function schemaCount(schema: unknown): number {
  if (Array.isArray(schema)) return schema.length;
  if (schema && typeof schema === "object") {
    return Object.keys(schema as Record<string, unknown>).length;
  }
  return 0;
}

export default function MarketplaceReviews() {
  const { loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ["marketplace-pending-reviews"],
    queryFn: listPendingReviews,
    enabled: isAuthenticated,
    // The list is fast-changing (devs submit, admins act) — refetch on
    // window focus so an admin alt-tabbing back doesn't act on stale data.
    refetchOnWindowFocus: true,
  });

  // Track the version + decision currently mid-flight so the matching
  // button shows a spinner and we can disable both sides during the
  // round-trip. Keying on (versionId, decision) lets us detect "user
  // mashed approve twice on different cards" cleanly.
  const [inFlight, setInFlight] = useState<{
    versionId: string;
    decision: ReviewDecision;
  } | null>(null);

  const decisionMutation = useMutation({
    mutationFn: ({
      versionId,
      decision,
      notes,
    }: {
      versionId: string;
      decision: ReviewDecision;
      notes: string;
    }) => submitReviewDecision(versionId, decision, notes || undefined),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.decision === "approve"
          ? "Version approved and published"
          : "Version rejected",
      );
      queryClient.invalidateQueries({
        queryKey: ["marketplace-pending-reviews"],
      });
    },
    onError: (err) =>
      toast.error((err as Error).message || "Failed to submit decision"),
    onSettled: () => setInFlight(null),
  });

  const handleDecision = (
    versionId: string,
    decision: ReviewDecision,
    notes: string,
  ) => {
    setInFlight({ versionId, decision });
    decisionMutation.mutate({ versionId, decision, notes });
  };

  if (loading) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
      return <DashboardLayoutSkeleton />;
    }
  }

  const items = pendingQuery.data ?? [];
  const isLoadingList = pendingQuery.isLoading;

  return (
    <DashboardLayout
      title="Marketplace Reviews"
      subtitle="Approve or reject BYOT theme versions submitted to the marketplace"
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pending reviews</span>
              <Badge variant="secondary">{items.length}</Badge>
            </CardTitle>
            <CardDescription>
              Versions awaiting admin moderation. Approval publishes the
              version; rejection sends the notes back to the developer.
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoadingList ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <ExternalLink className="w-8 h-8 text-muted-foreground" />
            <div className="text-lg font-semibold">No pending reviews</div>
            <div className="text-sm text-muted-foreground">
              All submitted theme versions have been moderated.
            </div>
          </Empty>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ReviewCard
                key={item.version_id}
                item={item}
                onDecision={handleDecision}
                pendingDecision={
                  inFlight?.versionId === item.version_id
                    ? inFlight.decision
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
