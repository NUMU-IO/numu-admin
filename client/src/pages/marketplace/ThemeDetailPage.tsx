/**
 * ThemeDetailPage — Session C (2026-05-28).
 *
 * Single-theme admin editor at `/marketplace/themes/:slug` per file 05 §3.
 * Five tabs: Overview · Metadata · Screenshots · Highlights · Versions.
 *
 * Each tab owns its own state but shares the same React Query cache key
 * (`["admin-theme-detail", themeId]`) so a Metadata save invalidates
 * the entire detail view. The Versions tab uses its own key
 * (`["admin-theme-versions", themeId]`) so version reads don't get
 * invalidated by metadata writes.
 *
 * Header card sits above the tabs: thumbnail + name + slug + status +
 * price chip (reuses Session B's ThemePriceInlineEdit so price edits
 * here keep the list-page chip in sync via the shared
 * ["admin-marketplace-themes"] cache invalidation).
 *
 * Out of scope for Session C (deferred to follow-up sessions):
 *  - Image uploads (Screenshots tab — uses URL inputs for now)
 *  - "Pin to default" on a specific version (Versions tab — UI shows
 *    "Coming soon")
 *  - Reviews tab (file 05 §5)
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminTheme,
  listAdminThemes,
  updateThemeMetadata,
  type AdminThemeMetadataResponse,
  type Highlight,
  type Screenshot,
  type ThemeMetadataPatch,
} from "@/services/marketplaceAdminApi";
import {
  listAdminThemeVersions,
  type AdminMarketplaceVersion,
} from "@/services/marketplaceVersionsApi";
import { ThemePriceInlineEdit } from "./_shared/ThemePriceInlineEdit";
import { THEMES_QUERY_KEY } from "./ThemesPage";

// ── Shared category + feature tag lists (per file 05 §3.2) ─────────────────
//
// Categories: the 7 buckets file 03 §8 outlined. Admin picks one per
// theme so the catalog filter UI in merchant-hub can group them later.
// Feature tags: short capability flags (Shopify-style). The list is
// suggestive — admins can also free-form via the tags chip input.

const THEME_CATEGORIES = [
  "food-and-beverage",
  "fashion",
  "sports-and-streetwear",
  "electronics-and-tech",
  "beauty-and-skincare",
  "art-and-design",
  "general",
];

const FEATURE_TAG_OPTIONS = [
  "sticky-header",
  "mega-menu",
  "color-swatches",
  "quick-buy",
  "infinite-scroll",
  "product-zoom",
  "video-hero",
  "image-with-text",
  "lookbook",
  "testimonials",
  "newsletter",
  "press-mentions",
  "shoppable-instagram",
  "size-chart",
  "wishlist",
  "promo-banner",
  "countdown-timer",
  "sticky-cart",
  "predictive-search",
  "multi-currency",
];

const SUPPORTED_LANGUAGE_OPTIONS = ["en", "ar"];

// React Query keys — kept module-local so other files can import + invalidate.
export const themeDetailKey = (themeId: string) =>
  ["admin-theme-detail", themeId] as const;
export const themeVersionsKey = (themeId: string) =>
  ["admin-theme-versions", themeId] as const;

export default function ThemeDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // First resolve slug → id via the existing list query. Avoids a new
  // "by-slug" endpoint; the list is cached for 30s so navigation is
  // typically zero-fetch.
  const themesQuery = useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: listAdminThemes,
    staleTime: 30_000,
  });

  const themeId = useMemo(() => {
    return themesQuery.data?.themes.find((t) => t.slug === slug)?.id ?? null;
  }, [themesQuery.data, slug]);

  const detailQuery = useQuery({
    enabled: Boolean(themeId),
    queryKey: themeId ? themeDetailKey(themeId) : ["admin-theme-detail", "none"],
    queryFn: () => getAdminTheme(themeId as string),
    staleTime: 30_000,
  });

  if (themesQuery.isLoading || (themeId && detailQuery.isLoading)) {
    return <DashboardLayoutSkeleton />;
  }

  if (!themeId) {
    return (
      <DashboardLayout title="Marketplace themes">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme not found</CardTitle>
              <CardDescription>
                No theme with slug{" "}
                <code className="text-xs">{slug}</code> exists in the
                marketplace. It may have been deleted or never created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/marketplace/themes">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to themes
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const msg =
      detailQuery.error instanceof Error
        ? detailQuery.error.message
        : "Unknown error";
    return (
      <DashboardLayout title="Marketplace themes">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Couldn't load theme</CardTitle>
              <CardDescription>{msg}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Theme: ${detailQuery.data.name}`}>
      <ThemeDetailInner theme={detailQuery.data} themeId={themeId} />
    </DashboardLayout>
  );
}

// ── Header + tabs container ───────────────────────────────────────────────

interface InnerProps {
  theme: AdminThemeMetadataResponse;
  themeId: string;
}

function ThemeDetailInner({ theme, themeId }: InnerProps) {
  const queryClient = useQueryClient();

  // The price-chip mutation invalidates BOTH the detail cache (this
  // page) and the list cache (so the list-page chip refreshes when the
  // admin navigates back).
  const priceMutation = useMutation({
    mutationFn: (nextCents: number) =>
      updateThemeMetadata(themeId, { price_cents: nextCents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeDetailKey(themeId) });
      queryClient.invalidateQueries({ queryKey: THEMES_QUERY_KEY });
      toast.success(`Updated ${theme.name}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <Link href="/marketplace/themes">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Themes
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              {/* Thumbnail. Falls back to slug initials when no
                  thumbnail_url is set — keeps the header layout stable
                  whether the theme has an image or not. */}
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border">
                {theme.thumbnail_url ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img
                    src={theme.thumbnail_url}
                    alt={`${theme.name} thumbnail`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground uppercase">
                    {theme.slug.slice(0, 2)}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <span className="truncate">{theme.name}</span>
                  <Badge variant={theme.status === "published" ? "default" : "secondary"}>
                    {theme.status}
                  </Badge>
                  <ThemePriceInlineEdit
                    priceCents={theme.price_cents}
                    currency={theme.currency || "USD"}
                    onCommit={(nextCents) => priceMutation.mutateAsync(nextCents)}
                    disabled={priceMutation.isPending}
                  />
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-1">
                  {theme.slug} · {theme.install_count} install
                  {theme.install_count === 1 ? "" : "s"}
                  {theme.author_name ? ` · by ${theme.author_name}` : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="screenshots">
            Screenshots
            <Badge variant="outline" className="ml-2 px-1.5 py-0 h-4 text-[10px]">
              {theme.screenshots.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="highlights">
            Highlights
            <Badge variant="outline" className="ml-2 px-1.5 py-0 h-4 text-[10px]">
              {theme.highlights.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab theme={theme} />
        </TabsContent>
        <TabsContent value="metadata">
          <MetadataTab theme={theme} themeId={themeId} />
        </TabsContent>
        <TabsContent value="screenshots">
          <ScreenshotsTab theme={theme} themeId={themeId} />
        </TabsContent>
        <TabsContent value="highlights">
          <HighlightsTab theme={theme} themeId={themeId} />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab themeId={themeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tab 1: Overview ────────────────────────────────────────────────────────

function OverviewTab({ theme }: { theme: AdminThemeMetadataResponse }) {
  // Read-only stats per file 05 §3.1. Sticking to fields the backend
  // already serialises — review_count + average_rating live in the
  // model but aren't on AdminThemeMetadataResponse yet. Display "N/A"
  // until reviews UI ships in file 05 §5 (Session D+).
  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Active installs", value: theme.install_count.toString() },
    { label: "Status", value: <Badge variant="outline">{theme.status}</Badge> },
    { label: "Price", value: theme.price_cents === 0 ? "Free" : `${Math.round(theme.price_cents / 100)} ${theme.currency}` },
    {
      label: "Category",
      value: theme.category ?? <span className="text-muted-foreground">—</span>,
    },
    { label: "Author", value: theme.author_name ?? <span className="text-muted-foreground">—</span> },
    {
      label: "Average rating",
      value: <span className="text-muted-foreground italic">N/A (reviews UI not shipped)</span>,
    },
    {
      label: "Review count",
      value: <span className="text-muted-foreground italic">N/A</span>,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">At a glance</CardTitle>
        <CardDescription>
          Read-only summary. Edit metadata in the Metadata tab; toggle flags
          on the <Link href="/marketplace/themes" className="underline underline-offset-2">themes list</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {items.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 pt-4 border-t space-y-2">
          <h3 className="text-sm font-semibold">Flags</h3>
          {Object.keys(theme.flags || {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No flags set — theme is invisible in the public catalog.
            </p>
          ) : (
            <pre className="text-xs bg-muted/50 rounded p-3 font-mono overflow-auto">
              {JSON.stringify(theme.flags, null, 2)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab 2: Metadata ────────────────────────────────────────────────────────

function MetadataTab({ theme, themeId }: InnerProps) {
  const queryClient = useQueryClient();

  // Local draft state. We snapshot the server-provided values into the
  // form on mount + re-snapshot when the server value changes (cache
  // invalidate after another save in a different tab). The dirty check
  // is shallow — sufficient for a flat shape with no nested arrays.
  const [draft, setDraft] = useState<ThemeMetadataPatch>(() => ({
    name: theme.name,
    description: theme.description ?? "",
    short_description: theme.short_description ?? "",
    author_name: theme.author_name ?? "",
    author_url: theme.author_url ?? "",
    category: theme.category ?? "",
    tags: theme.tags ?? [],
    feature_tags: theme.feature_tags ?? [],
    supported_languages: theme.supported_languages ?? [],
    demo_store_url: theme.demo_store_url ?? "",
    thumbnail_url: theme.thumbnail_url ?? "",
  }));

  const mutation = useMutation({
    mutationFn: (patch: ThemeMetadataPatch) =>
      updateThemeMetadata(themeId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeDetailKey(themeId) });
      queryClient.invalidateQueries({ queryKey: THEMES_QUERY_KEY });
      toast.success("Metadata saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  // Compute the patch by diffing draft vs server. Submitting only the
  // changed fields keeps the PATCH semantics intact and avoids
  // accidentally clobbering fields edited elsewhere.
  const patchToSend = useMemo<ThemeMetadataPatch>(() => {
    const out: ThemeMetadataPatch = {};
    const fields: (keyof ThemeMetadataPatch)[] = [
      "name",
      "description",
      "short_description",
      "author_name",
      "author_url",
      "category",
      "demo_store_url",
      "thumbnail_url",
    ];
    for (const f of fields) {
      const draftVal = (draft[f] ?? "") as string;
      const serverVal = (theme[f as keyof AdminThemeMetadataResponse] ?? "") as string;
      if (draftVal !== serverVal) {
        // Normalise empty strings to null so the server stores NULL
        // rather than an empty string on optional columns.
        (out as Record<string, unknown>)[f] = draftVal === "" ? null : draftVal;
      }
    }
    // Array comparison via JSON — cheap enough for short arrays.
    if (JSON.stringify(draft.tags) !== JSON.stringify(theme.tags ?? [])) {
      out.tags = draft.tags;
    }
    if (
      JSON.stringify(draft.feature_tags) !==
      JSON.stringify(theme.feature_tags ?? [])
    ) {
      out.feature_tags = draft.feature_tags;
    }
    if (
      JSON.stringify(draft.supported_languages) !==
      JSON.stringify(theme.supported_languages ?? [])
    ) {
      out.supported_languages = draft.supported_languages;
    }
    return out;
  }, [draft, theme]);

  const isDirty = Object.keys(patchToSend).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metadata</CardTitle>
        <CardDescription>
          Editable through PATCH{" "}
          <code className="text-xs">/marketplace/admin/themes/{theme.id.slice(0, 8)}…</code>.
          PATCH semantics — only changed fields are sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name (en)" id="meta-name">
            <Input
              id="meta-name"
              value={draft.name ?? ""}
              maxLength={255}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
          </Field>
          <Field label="Slug (read-only)" id="meta-slug">
            <Input
              id="meta-slug"
              value={theme.slug}
              readOnly
              className="font-mono text-xs bg-muted/40"
            />
          </Field>

          <Field
            label="Short description"
            id="meta-short"
            help="Tagline; surfaces on theme cards."
          >
            <Input
              id="meta-short"
              value={draft.short_description ?? ""}
              maxLength={500}
              onChange={(e) =>
                setDraft((d) => ({ ...d, short_description: e.target.value }))
              }
            />
          </Field>
          <Field label="Demo store URL" id="meta-demo">
            <Input
              id="meta-demo"
              type="url"
              value={draft.demo_store_url ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, demo_store_url: e.target.value }))
              }
              placeholder="https://demo.example/store"
            />
          </Field>

          <Field
            label="Author name"
            id="meta-author-name"
            help="Shown on theme cards as “By X”."
          >
            <Input
              id="meta-author-name"
              value={draft.author_name ?? ""}
              maxLength={128}
              onChange={(e) =>
                setDraft((d) => ({ ...d, author_name: e.target.value }))
              }
            />
          </Field>
          <Field label="Author URL" id="meta-author-url">
            <Input
              id="meta-author-url"
              type="url"
              value={draft.author_url ?? ""}
              maxLength={512}
              onChange={(e) =>
                setDraft((d) => ({ ...d, author_url: e.target.value }))
              }
              placeholder="https://author.example"
            />
          </Field>

          <Field label="Thumbnail URL" id="meta-thumb">
            <Input
              id="meta-thumb"
              type="url"
              value={draft.thumbnail_url ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, thumbnail_url: e.target.value }))
              }
              placeholder="https://cdn.numueg.app/…"
            />
          </Field>
          <Field label="Category" id="meta-category">
            <Select
              value={draft.category ?? ""}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, category: v === "__none__" ? "" : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a category…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">— Unset —</span>
                </SelectItem>
                {THEME_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Description"
          id="meta-desc"
          help="Long-form copy for the detail page. Max 500 chars."
        >
          <Textarea
            id="meta-desc"
            rows={5}
            value={draft.description ?? ""}
            maxLength={500}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
        </Field>

        <Field
          label="Tags"
          id="meta-tags"
          help="Comma-separated free-form tags. Used by the catalog search."
        >
          <Input
            id="meta-tags"
            value={(draft.tags ?? []).join(", ")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                tags: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="cafe, brunch, mansoura"
          />
        </Field>

        <Field
          label="Feature tags"
          id="meta-features"
          help="Capability chips rendered on catalog cards. Pick from the suggested list or add your own (comma-separated)."
        >
          <div className="flex flex-wrap gap-2 mb-2">
            {FEATURE_TAG_OPTIONS.map((tag) => {
              const active = (draft.feature_tags ?? []).includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() =>
                    setDraft((d) => {
                      const current = d.feature_tags ?? [];
                      return {
                        ...d,
                        feature_tags: current.includes(tag)
                          ? current.filter((t) => t !== tag)
                          : [...current, tag],
                      };
                    })
                  }
                  className={
                    "text-xs px-2 py-1 rounded-full border transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent")
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <Input
            id="meta-features"
            value={(draft.feature_tags ?? []).join(", ")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                feature_tags: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="sticky-header, mega-menu, …"
          />
        </Field>

        <Field
          label="Supported languages"
          id="meta-langs"
          help="Locales the theme ships translations for."
        >
          <div className="flex gap-3">
            {SUPPORTED_LANGUAGE_OPTIONS.map((lang) => {
              const active = (draft.supported_languages ?? []).includes(lang);
              return (
                <label key={lang} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      setDraft((d) => {
                        const current = d.supported_languages ?? [];
                        return {
                          ...d,
                          supported_languages: current.includes(lang)
                            ? current.filter((l) => l !== lang)
                            : [...current, lang],
                        };
                      })
                    }
                  />
                  {lang}
                </label>
              );
            })}
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            disabled={!isDirty || mutation.isPending}
            onClick={() =>
              setDraft({
                name: theme.name,
                description: theme.description ?? "",
                short_description: theme.short_description ?? "",
                author_name: theme.author_name ?? "",
                author_url: theme.author_url ?? "",
                category: theme.category ?? "",
                tags: theme.tags ?? [],
                feature_tags: theme.feature_tags ?? [],
                supported_languages: theme.supported_languages ?? [],
                demo_store_url: theme.demo_store_url ?? "",
                thumbnail_url: theme.thumbnail_url ?? "",
              })
            }
          >
            Discard
          </Button>
          <Button
            onClick={() => mutation.mutate(patchToSend)}
            disabled={!isDirty || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  id,
  help,
  children,
}: {
  label: string;
  id: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? <p className="text-[11px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}

// ── Tab 3: Screenshots ────────────────────────────────────────────────────

function ScreenshotsTab({ theme, themeId }: InnerProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Screenshot[]>(theme.screenshots ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (next: Screenshot[]) =>
      updateThemeMetadata(themeId, { screenshots: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeDetailKey(themeId) });
      toast.success("Screenshots saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  const isDirty =
    JSON.stringify(items) !== JSON.stringify(theme.screenshots ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Screenshots</span>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add screenshot
          </Button>
        </CardTitle>
        <CardDescription>
          Carousel images on the theme detail page. Recommended: 2–8
          screenshots; desktop ~1000×1248, mobile ~750×1334. Drag-reorder
          is deferred — use the up/down arrows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No screenshots yet. Click <em>Add screenshot</em>.
          </p>
        ) : (
          items.map((s, idx) => (
            <div
              key={`${s.url}-${idx}`}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <div className="w-24 h-24 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                {/* Image preview — falls back to icon when the URL
                    can't be loaded (CORS, 404, etc). */}
                <img
                  src={s.url}
                  alt={s.alt ?? ""}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate">{s.url}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.alt || <em>(no alt)</em>} ·{" "}
                  <Badge variant="outline" className="ml-0">
                    {s.viewport || "desktop"}
                  </Badge>
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={idx === 0}
                  onClick={() => {
                    setItems((prev) => {
                      const next = [...prev];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      return next;
                    });
                  }}
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={idx === items.length - 1}
                  onClick={() => {
                    setItems((prev) => {
                      const next = [...prev];
                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                      return next;
                    });
                  }}
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => {
                    setItems((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            disabled={!isDirty || mutation.isPending}
            onClick={() => setItems(theme.screenshots ?? [])}
          >
            Discard
          </Button>
          <Button
            disabled={!isDirty || mutation.isPending}
            onClick={() => mutation.mutate(items)}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save screenshots
          </Button>
        </div>
      </CardContent>

      <AddScreenshotDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={(s) => {
          setItems((prev) => [...prev, s]);
          setDialogOpen(false);
        }}
      />
    </Card>
  );
}

function AddScreenshotDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (s: Screenshot) => void;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setUrl("");
          setAlt("");
          setViewport("desktop");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add screenshot</DialogTitle>
          <DialogDescription>
            Provide the image URL + alt text + viewport. Image upload is
            coming in a future session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="URL" id="sshot-url">
            <Input
              id="sshot-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cdn.numueg.app/screens/…"
              autoFocus
            />
          </Field>
          <Field label="Alt text" id="sshot-alt">
            <Input
              id="sshot-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Hero section on desktop"
            />
          </Field>
          <Field label="Viewport" id="sshot-viewport">
            <div className="flex gap-3">
              {(["desktop", "mobile"] as const).map((vp) => (
                <label key={vp} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="sshot-viewport"
                    value={vp}
                    checked={viewport === vp}
                    onChange={() => setViewport(vp)}
                  />
                  {vp}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!url}
            onClick={() => {
              onAdd({ url, alt: alt || null, viewport });
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab 4: Highlights ─────────────────────────────────────────────────────

function HighlightsTab({ theme, themeId }: InnerProps) {
  const queryClient = useQueryClient();
  // Always pad to 3 tiles so the layout is stable. Empty tiles render
  // an "Add" CTA inline; saving sends only the populated tiles back.
  const [tiles, setTiles] = useState<Array<Highlight | null>>(() => {
    const initial = theme.highlights ?? [];
    return [0, 1, 2].map((i) => initial[i] ?? null);
  });

  const mutation = useMutation({
    mutationFn: (next: Highlight[]) =>
      updateThemeMetadata(themeId, { highlights: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeDetailKey(themeId) });
      toast.success("Highlights saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  const populated = tiles.filter((t): t is Highlight => t !== null);
  const serverPopulated = theme.highlights ?? [];
  const isDirty =
    JSON.stringify(populated) !== JSON.stringify(serverPopulated);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Highlights</CardTitle>
        <CardDescription>
          Three Shopify-style spotlight tiles. Title ≤ 30 chars, body ≤ 140.
          The first tile can include an optional video URL; the other two
          are text-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiles.map((tile, idx) => (
            <HighlightTile
              key={idx}
              tile={tile}
              allowVideo={idx === 0}
              onChange={(next) =>
                setTiles((prev) => {
                  const cp = [...prev];
                  cp[idx] = next;
                  return cp;
                })
              }
              onClear={() =>
                setTiles((prev) => {
                  const cp = [...prev];
                  cp[idx] = null;
                  return cp;
                })
              }
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            disabled={!isDirty || mutation.isPending}
            onClick={() => {
              const initial = theme.highlights ?? [];
              setTiles([0, 1, 2].map((i) => initial[i] ?? null));
            }}
          >
            Discard
          </Button>
          <Button
            disabled={!isDirty || mutation.isPending}
            onClick={() => mutation.mutate(populated)}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save highlights
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightTile({
  tile,
  allowVideo,
  onChange,
  onClear,
}: {
  tile: Highlight | null;
  allowVideo: boolean;
  onChange: (next: Highlight) => void;
  onClear: () => void;
}) {
  if (tile === null) {
    return (
      <button
        type="button"
        onClick={() => onChange({ title: "", body: "" })}
        className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40 transition-colors min-h-[180px] flex flex-col items-center justify-center gap-2"
      >
        <Plus className="h-5 w-5" />
        Add highlight
      </button>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 min-h-[180px] flex flex-col">
      <Input
        value={tile.title}
        maxLength={30}
        placeholder="Title"
        onChange={(e) => onChange({ ...tile, title: e.target.value })}
      />
      <Textarea
        value={tile.body}
        maxLength={140}
        placeholder="Body"
        rows={3}
        onChange={(e) => onChange({ ...tile, body: e.target.value })}
      />
      {allowVideo && (
        <Input
          type="url"
          value={tile.video_url ?? ""}
          placeholder="Optional video URL (YouTube/Vimeo embed)"
          onChange={(e) =>
            onChange({ ...tile, video_url: e.target.value || null })
          }
        />
      )}
      <div className="flex justify-end mt-auto">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive h-7 -mr-2"
          onClick={onClear}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
}

// ── Tab 5: Versions ──────────────────────────────────────────────────────

function VersionsTab({ themeId }: { themeId: string }) {
  const query = useQuery({
    queryKey: themeVersionsKey(themeId),
    queryFn: () => listAdminThemeVersions(themeId),
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Versions</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={
                "h-4 w-4 mr-2" + (query.isFetching ? " animate-spin" : "")
              }
            />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Read-only. Pin-to-default is coming in a follow-up session —
          newer installs always get the latest published version today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading versions…</p>
        ) : query.isError ? (
          <p className="text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Couldn't load"}
          </p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No versions yet. Developers submit versions via{" "}
            <code className="text-xs">numu-theme submit</code>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Version</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Bundle</th>
                  <th className="text-right py-2 px-3 font-medium">Size</th>
                  <th className="text-right py-2 pl-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {(query.data ?? []).map((v) => (
                  <VersionRow key={v.id} version={v} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VersionRow({ version }: { version: AdminMarketplaceVersion }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-3 font-mono">{version.version_string}</td>
      <td className="py-2 px-3">
        <Badge variant={version.status === "published" ? "default" : "secondary"}>
          {version.status}
        </Badge>
      </td>
      <td className="py-2 px-3 font-mono text-xs text-muted-foreground max-w-[280px] truncate">
        {version.bundle_url ?? <em>(none)</em>}
      </td>
      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
        {version.size_bytes != null
          ? `${(version.size_bytes / 1024).toFixed(1)} KB`
          : "—"}
      </td>
      <td className="py-2 pl-3 text-right text-muted-foreground">
        {version.created_at
          ? new Date(version.created_at).toLocaleDateString()
          : "—"}
      </td>
    </tr>
  );
}
