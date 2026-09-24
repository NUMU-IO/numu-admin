/**
 * Apps & Partners → App review.
 *
 * The queue is every submitted or in-review review round (a version, a
 * listing, or both together), oldest first, with its age against the
 * 3-business-day SLA; opening one claims it (in_review). The review view
 * shows what the reviewer must judge:
 *
 *   - what changed against the live version (new scopes and URLs first),
 *   - the proposed listing against the live one, a name change first,
 *   - the requested scopes, URLs and webhooks,
 *   - the App Review Guidelines as a checklist (required items marked),
 *   - every earlier round of this app.
 *
 * Approve stays disabled until every required item is ticked; request
 * changes and reject need notes in Arabic and English (the partner reads
 * them). The internal note is for staff only and never reaches the partner.
 * Decisions need the 2FA step-up and land in audit_logs.
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  Badge,
  Banner,
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
  decideReview,
  getReview,
  listReviewQueue,
  type AppChangeType,
  type AppManifest,
  type Bilingual,
  type ListingContent,
  type ReviewDetail,
  type ReviewRow,
  type ReviewSubject,
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

const SUBJECT: Record<ReviewSubject, string> = {
  version: "Version",
  listing: "Listing",
  version_listing: "Version + listing",
};

const SLA_BUSINESS_DAYS = 3;

/**
 * What the manifest charges, next to what its listing says, so a reviewer
 * can tick `price_matches`: "EGP 99.00 / month", "free", "external: …".
 */
function priceText(p: AppManifest["pricing"] | undefined): string {
  if (!p) return "—";
  const label = p.label?.en ? ` (listing: ${p.label.en})` : "";
  const usage = p.usage
    ? `usage${p.usage.price_cents ? ` ${formatMoney(p.usage.price_cents)} per ${p.usage.unit.en}` : ""}, cap ${formatMoney(p.usage.cap_cents)} / month`
    : "";
  const trial = p.trial_days ? `${p.trial_days}-day free trial, then ` : "";
  if (p.model === "usage") return `${usage}${label}`;
  if (p.model === "recurring")
    return `${trial}${formatMoney(p.price_cents)} / ${p.cycle === "annual" ? "year" : "month"}${usage ? ` + ${usage}` : ""}${label}`;
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

function slaBadge(row: ReviewRow): { tone: "danger" | "warning" | "success"; label: string } {
  const waited = `${row.business_days_waiting}/${SLA_BUSINESS_DAYS} business days`;
  if (row.overdue) return { tone: "danger", label: `Overdue · ${waited}` };
  const dueToday = row.due_at ? new Date(row.due_at).toDateString() === new Date().toDateString() : false;
  if (dueToday) return { tone: "warning", label: `Due today · ${waited}` };
  return { tone: "success", label: waited };
}

function rowTitle(row: Pick<ReviewRow, "name" | "slug" | "version" | "subject">): string {
  const what = row.version ? `v${row.version}` : "listing";
  return `${row.name.en ?? row.slug} · ${what}${row.subject === "version_listing" ? " + listing" : ""}`;
}

const nameText = (n: Bilingual) => `${n.en} / ${n.ar}`;

function scopes(m: AppManifest | null): Set<string> {
  if (!m) return new Set();
  return new Set([...(m.oauth?.scopes ?? []), ...(m.oauth?.optional_scopes ?? [])]);
}

function QueueRow({ row, active, onOpen }: { row: ReviewRow; active: boolean; onOpen: () => void }) {
  const sla = slaBadge(row);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-start"
      aria-current={active ? "true" : undefined}
    >
      <Card
        title={rowTitle(row)}
        subtitle={`${row.partner ?? "Unknown partner"} · ${row.slug} · round ${row.round}`}
        actions={
          <div className="ak-cell-line">
            <Badge tone={CHANGE[row.change_type].tone}>{CHANGE[row.change_type].label}</Badge>
            {row.name_change ? <Badge tone="warning">Name change</Badge> : null}
            <Badge tone={sla.tone} icon="clock">
              {sla.label}
            </Badge>
          </div>
        }
      />
    </button>
  );
}

function ListingCompare({ proposed, live }: { proposed: ListingContent; live: ListingContent }) {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const mark = (k: keyof ListingContent) => (same(proposed[k], live[k]) ? "" : " (changed)");
  const items: KeyValueItem[] = [
    {
      label: `Category${mark("category")}`,
      value: same(proposed.category, live.category) ? proposed.category : `${live.category} → ${proposed.category}`,
    },
    { label: `Video${mark("video_url")}`, value: proposed.video_url ?? "—", mono: true },
    { label: `Keywords (en)${mark("keywords")}`, value: proposed.keywords.en.join(", ") || "—" },
    { label: "Keywords (ar)", value: proposed.keywords.ar.join("، ") || "—" },
    { label: `Screenshots${mark("screenshots")}`, value: String(proposed.screenshots.length) },
  ];
  return (
    <Card title="Proposed listing" subtitle="Fields marked (changed) differ from the live listing.">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["ar", "en"] as const).map((lang) => (
          <div key={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="space-y-1">
            <p className="font-semibold">{proposed.name[lang]}</p>
            <p className="text-muted-foreground">{proposed.tagline[lang]}</p>
            <p className="whitespace-pre-line">{proposed.description[lang]}</p>
            {proposed.tagline[lang] !== live.tagline[lang] ? (
              <p className="text-xs text-muted-foreground">Live tagline: {live.tagline[lang]}</p>
            ) : null}
            {proposed.description[lang] !== live.description[lang] ? (
              <p className="text-xs text-muted-foreground">Description changed.</p>
            ) : null}
          </div>
        ))}
      </div>
      <KeyValue items={items} />
      {proposed.screenshots.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {proposed.screenshots.map((s) => (
            <a key={s.src} href={s.src} target="_blank" rel="noopener noreferrer">
              <img src={s.src} alt={s.caption?.en ?? ""} className="h-32 rounded border" />
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ManifestCards({ d, m }: { d: ReviewDetail; m: AppManifest }) {
  const added = Array.from(scopes(m)).filter((s) => !scopes(d.published_manifest).has(s));
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
  ];
  return (
    <>
      <Card title="What the app asks for">
        <KeyValue items={contract} />
      </Card>
      {d.release_notes?.ar || d.release_notes?.en ? (
        <Card title="Release notes">
          <div className="grid gap-4 sm:grid-cols-2">
            <p dir="rtl" lang="ar" className="whitespace-pre-line">
              {d.release_notes?.ar}
            </p>
            <p dir="ltr" lang="en" className="whitespace-pre-line">
              {d.release_notes?.en}
            </p>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function History({ rounds, current }: { rounds: ReviewDetail["history"]; current: string }) {
  const past = rounds.filter((r) => r.review_id !== current);
  if (!past.length) return null;
  return (
    <Card title="Earlier rounds">
      <div className="space-y-3">
        {past.map((r) => (
          <div key={r.review_id} className="rounded border p-3 space-y-1">
            <div className="ak-cell-line">
              <strong>Round {r.round}</strong>
              <span>
                {r.version ? `v${r.version}` : "listing"} · {SUBJECT[r.subject]}
              </span>
              <StatusBadge status="pending" label={r.status.replace("_", " ")} />
            </div>
            <p className="text-xs text-muted-foreground">
              {r.submitted_at ? `Submitted ${formatDateTime(r.submitted_at)}` : ""}
              {r.decided_at ? ` · decided ${formatDateTime(r.decided_at)}` : ""}
              {r.reviewer ? ` · ${r.reviewer}` : ""}
            </p>
            {r.notes?.en ? <p className="whitespace-pre-line text-sm">To partner: {r.notes.en}</p> : null}
            {r.internal_note ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">Staff only: {r.internal_note}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReviewPanel({ reviewId, onDone }: { reviewId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["app-review", "review", reviewId],
    queryFn: () => getReview(reviewId),
  });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notesAr, setNotesAr] = useState("");
  const [notesEn, setNotesEn] = useState("");
  const [internal, setInternal] = useState("");

  const decide = useMutation({
    mutationFn: (decision: "approve" | "request_changes" | "reject") =>
      decideReview(reviewId, {
        decision,
        checklist: checks,
        notes_ar: notesAr.trim() || undefined,
        notes_en: notesEn.trim() || undefined,
        internal_note: internal.trim() || undefined,
      }),
    onSuccess: (row) => {
      toast.success(`${rowTitle(row)}: ${row.status.replace("_", " ")}`, {
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
        <EmptyState kind="error" title="Review failed to load" body={String(detail.error ?? "")} />
      </Card>
    );
  }
  const d = detail.data;
  const m = d.manifest;
  const required = new Set(d.required_checks);
  const allTicked = d.required_checks.every((k) => checks[k]);
  const notesOk = notesAr.trim().length > 0 && notesEn.trim().length > 0;
  const live = d.live_listing;

  return (
    <div className="space-y-4">
      {d.name_change ? (
        <Banner tone="warning" title="Name will change">
          {nameText(d.name_change.from)} → {nameText(d.name_change.to)}
        </Banner>
      ) : null}

      <Card
        title={rowTitle(d)}
        subtitle={[
          d.partner ?? "Unknown partner",
          `round ${d.round}`,
          d.submitted_at ? `submitted ${formatDateTime(d.submitted_at)}` : null,
          d.due_at ? `due ${formatDateTime(d.due_at)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="ak-cell-line">
            <Badge tone="info">{SUBJECT[d.subject]}</Badge>
            <Badge tone={CHANGE[d.change_type].tone}>{CHANGE[d.change_type].label}</Badge>
            <StatusBadge status="pending" label={d.status.replace("_", " ")} />
          </div>
        }
      >
        {d.listing ? (
          <p className="text-sm text-muted-foreground">This round changes the listing; see the proposed listing below.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["ar", "en"] as const).map((lang) => (
              <div key={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="space-y-1">
                <p className="font-semibold">{live.name[lang]}</p>
                <p className="text-muted-foreground">{live.tagline[lang]}</p>
                <p className="whitespace-pre-line">{live.description[lang]}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d.listing ? <ListingCompare proposed={d.listing} live={live} /> : null}
      {m ? <ManifestCards d={d} m={m} /> : null}

      <Card title="App Review Guidelines" subtitle="Approve needs every item marked required.">
        <div className="space-y-1">
          {Object.entries(d.checklist).map(([key, label]) => (
            <Checkbox
              key={key}
              label={required.has(key) ? `${label} (required)` : label}
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
        <FormField
          label="Notes to the partner (Arabic, Egyptian)"
          htmlFor="app-notes-ar"
          hint="The partner reads these. Required to request changes or reject."
        >
          <Textarea id="app-notes-ar" dir="rtl" rows={3} value={notesAr} onChange={(e) => setNotesAr(e.target.value)} />
        </FormField>
        <FormField label="Notes to the partner (English)" htmlFor="app-notes-en" hint="The partner reads these.">
          <Textarea id="app-notes-en" rows={3} value={notesEn} onChange={(e) => setNotesEn(e.target.value)} />
        </FormField>
        <FormField
          label="Internal note (staff only)"
          htmlFor="app-notes-internal"
          hint="Never shown to the partner. Kept in this app's review history."
        >
          <Textarea id="app-notes-internal" rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />
        </FormField>
      </Card>

      <History rounds={d.history} current={d.review_id} />

      {m ? (
        <Card title="numu.app.json">
          <pre dir="ltr" className="text-xs overflow-auto max-h-96">
            {JSON.stringify(m, null, 2)}
          </pre>
        </Card>
      ) : null}
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
      subtitle={`Partner-App versions and listings waiting for a decision, oldest first. Target: ${SLA_BUSINESS_DAYS} business days.`}
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
              <EmptyState kind="empty" icon="inbox" title="Queue is clear" body="Nothing waiting for review." />
            </Card>
          ) : null}
          {rows.map((row) => (
            <QueueRow
              key={row.review_id}
              row={row}
              active={row.review_id === openId}
              onOpen={() => setOpenId(row.review_id)}
            />
          ))}
        </div>
        <div>
          {openId ? (
            <ReviewPanel key={openId} reviewId={openId} onDone={() => setOpenId(null)} />
          ) : (
            <Card>
              <EmptyState kind="empty" icon="shieldAlert" title="Pick a review" body="Opening a review claims it for you." />
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
