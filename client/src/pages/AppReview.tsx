/**
 * Apps & Partners → App review (apps plan, Phase 3).
 *
 * The queue is every submitted or in-review Partner-App version, oldest
 * first; opening one claims it (in_review). The version view shows what the
 * reviewer must judge:
 *
 *   - what changed against the live version (new scopes and URLs first),
 *   - the listing in Arabic and English side by side,
 *   - the requested scopes, URLs and webhooks,
 *   - the ten App Review Guidelines items as a checklist.
 *
 * Approve stays disabled until every item is ticked; request changes and
 * reject need notes in Arabic and English (the partner reads them in their
 * language). All three need the 2FA step-up and land in audit_logs.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormField,
  KeyValue,
  Skeleton,
  StatusBadge,
  Textarea,
  type KeyValueItem,
} from "@/ds";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  getVersion,
  listReviewQueue,
  reviewAppVersion,
  type AppChangeType,
  type AppManifest,
  type ReviewRow,
} from "@/services/appsAdminApi";
import { is2FAError } from "@/services/platformCapabilitiesApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const CHANGE: Record<AppChangeType, { label: string; tone: "danger" | "warning" | "info" | "neutral" }> = {
  new_app: { label: "New app", tone: "info" },
  new_scopes: { label: "New scopes", tone: "danger" },
  urls: { label: "URLs changed", tone: "warning" },
  pricing: { label: "Price changed", tone: "warning" },
  listing_only: { label: "Listing only", tone: "neutral" },
};

/**
 * What the manifest charges, next to what its listing says, so a reviewer
 * can tick `price_matches`: "EGP 99.00 / month", "free", "external: …".
 */
function priceText(p: AppManifest["pricing"] | undefined): string {
  if (!p) return "—";
  const label = p.label?.en ? ` (listing: ${p.label.en})` : "";
  if (p.model === "recurring") return `${formatMoney(p.price_cents)} / ${p.cycle === "annual" ? "year" : "month"}${label}`;
  if (p.model === "external") return `external${label || " (billed by the partner)"}`;
  return p.model;
}

function onError(err: unknown) {
  if (is2FAError(err)) {
    toast.error("2FA step-up required", {
      description: "Verify your second factor again, then retry the decision.",
    });
    return;
  }
  toast.error(err instanceof Error ? err.message : String(err));
}

function ageTone(days: number): "danger" | "warning" | "neutral" {
  return days >= 5 ? "danger" : days >= 3 ? "warning" : "neutral";
}

function scopes(m: AppManifest | null): Set<string> {
  if (!m) return new Set();
  return new Set([...(m.oauth?.scopes ?? []), ...(m.oauth?.optional_scopes ?? [])]);
}

function QueueRow({ row, active, onOpen }: { row: ReviewRow; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-start"
      aria-current={active ? "true" : undefined}
    >
      <Card
        title={`${row.name.en ?? row.slug} · v${row.version}`}
        subtitle={`${row.partner ?? "Unknown partner"} · ${row.slug}`}
        actions={
          <div className="ak-cell-line">
            <Badge tone={CHANGE[row.change_type].tone}>{CHANGE[row.change_type].label}</Badge>
            <Badge tone={ageTone(row.age_days)}>{row.age_days}d</Badge>
          </div>
        }
      />
    </button>
  );
}

function VersionPanel({ versionId, onDone }: { versionId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["app-review", "version", versionId],
    queryFn: () => getVersion(versionId),
  });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notesAr, setNotesAr] = useState("");
  const [notesEn, setNotesEn] = useState("");

  const decide = useMutation({
    mutationFn: (decision: "approve" | "request_changes" | "reject") =>
      reviewAppVersion(versionId, {
        decision,
        checklist: checks,
        notes_ar: notesAr.trim() || undefined,
        notes_en: notesEn.trim() || undefined,
      }),
    onSuccess: (row) => {
      toast.success(`${row.name.en ?? row.slug} v${row.version}: ${row.status.replace("_", " ")}`, {
        description: "Recorded in the audit log against your account",
      });
      void queryClient.invalidateQueries({ queryKey: ["app-review"] });
      onDone();
    },
    onError,
  });

  if (detail.isLoading) return <Skeleton height={420} variant="block" />;
  if (detail.isError || !detail.data) {
    return (
      <Card>
        <EmptyState kind="error" title="Version failed to load" body={String(detail.error ?? "")} />
      </Card>
    );
  }
  const d = detail.data;
  const m = d.manifest;
  const added = Array.from(scopes(m)).filter((s) => !scopes(d.published_manifest).has(s));
  const allTicked = Object.keys(d.checklist).every((k) => checks[k]);
  const notesOk = notesAr.trim().length > 0 && notesEn.trim().length > 0;
  const price = priceText(m.pricing);
  const livePrice = d.published_manifest ? priceText(d.published_manifest.pricing) : price;

  const contract: KeyValueItem[] = [
    { label: "App URL", value: m.app_url, mono: true },
    { label: "Redirect URLs", value: m.oauth.redirect_urls.join("\n"), mono: true },
    { label: "Scopes", value: Array.from(scopes(m)).join(", "), mono: true },
    { label: "New scopes vs live", value: d.published_manifest ? added.join(", ") || "none" : "first version", mono: true },
    { label: "Webhooks", value: m.webhooks.map((w) => `${w.event} → ${w.url}`).join("\n"), mono: true },
    { label: "Privacy policy", value: m.developer.privacy_policy_url ?? "—", mono: true },
    { label: "Support", value: m.developer.support_email, mono: true },
    { label: "Category / price", value: `${m.category} · ${price}${livePrice !== price ? ` (live: ${livePrice})` : ""}` },
    { label: "Settings fields", value: String(m.settings_schema.length) },
    { label: "Submitted", value: d.submitted_at ? formatDateTime(d.submitted_at) : "—", mono: true },
  ];

  return (
    <div className="space-y-4">
      <Card
        title={`${m.name.en} · v${d.version}`}
        subtitle={d.partner ?? undefined}
        actions={
          <div className="ak-cell-line">
            <Badge tone={CHANGE[d.change_type].tone}>{CHANGE[d.change_type].label}</Badge>
            <StatusBadge status="pending" label={d.status.replace("_", " ")} />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div dir="rtl" lang="ar" className="space-y-1">
            <p className="font-semibold">{m.name.ar}</p>
            <p className="text-muted-foreground">{m.tagline.ar}</p>
            <p className="whitespace-pre-line">{m.description.ar}</p>
          </div>
          <div dir="ltr" lang="en" className="space-y-1">
            <p className="font-semibold">{m.name.en}</p>
            <p className="text-muted-foreground">{m.tagline.en}</p>
            <p className="whitespace-pre-line">{m.description.en}</p>
          </div>
        </div>
      </Card>

      <Card title="What the app asks for">
        <KeyValue items={contract} />
      </Card>

      <Card title="App Review Guidelines" subtitle="Approve needs every item.">
        <div className="space-y-1">
          {Object.entries(d.checklist).map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={!!checks[key]}
              onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
            />
          ))}
        </div>
      </Card>

      <Card
        title="Decision"
        footer={
          <div className="ak-cell-line">
            <Button
              variant="primary"
              icon="check"
              disabled={!allTicked || decide.isPending}
              onClick={() => decide.mutate("approve")}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              icon="refresh"
              disabled={!notesOk || decide.isPending}
              onClick={() => decide.mutate("request_changes")}
            >
              Request changes
            </Button>
            <Button
              variant="danger"
              icon="x"
              disabled={!notesOk || decide.isPending}
              onClick={() => decide.mutate("reject")}
            >
              Reject
            </Button>
          </div>
        }
      >
        <FormField label="Notes to the partner (Arabic, Egyptian)" htmlFor="app-notes-ar" hint="Required to request changes or reject.">
          <Textarea id="app-notes-ar" dir="rtl" rows={3} value={notesAr} onChange={(e) => setNotesAr(e.target.value)} />
        </FormField>
        <FormField label="Notes to the partner (English)" htmlFor="app-notes-en">
          <Textarea id="app-notes-en" rows={3} value={notesEn} onChange={(e) => setNotesEn(e.target.value)} />
        </FormField>
      </Card>

      <Card title="numu.app.json">
        <pre dir="ltr" className="text-xs overflow-auto max-h-96">
          {JSON.stringify(m, null, 2)}
        </pre>
      </Card>
    </div>
  );
}

export default function AppReview() {
  const [openId, setOpenId] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["app-review", "queue"],
    queryFn: listReviewQueue,
    refetchInterval: 30_000,
  });
  const rows = queue.data ?? [];

  return (
    <DashboardLayout
      title="App review"
      subtitle="Partner-App versions waiting for a decision, oldest first."
      actions={
        <Button variant="subtle" icon="refresh" loading={queue.isFetching} onClick={() => void queue.refetch()}>
          Refresh
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          {queue.isLoading ? <Skeleton height={120} variant="block" /> : null}
          {!queue.isLoading && rows.length === 0 ? (
            <Card>
              <EmptyState kind="empty" icon="inbox" title="Queue is clear" body="No app versions waiting for review." />
            </Card>
          ) : null}
          {rows.map((row) => (
            <QueueRow key={row.version_id} row={row} active={row.version_id === openId} onOpen={() => setOpenId(row.version_id)} />
          ))}
        </div>
        <div>
          {openId ? (
            <VersionPanel key={openId} versionId={openId} onDone={() => setOpenId(null)} />
          ) : (
            <Card>
              <EmptyState kind="empty" icon="shieldAlert" title="Pick a version" body="Opening a version claims it for you." />
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
