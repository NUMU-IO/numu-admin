/**
 * Platform Settings — Session B (2026-05-28).
 *
 * Single-purpose page (file 05 §4): pick the platform-wide default theme
 * applied to **newly-created stores**. Existing stores — including
 * sawsaw + rabbit — are NOT affected: the default is only consulted by
 * the create-store route in `stores.py:178`. This page never mutates
 * any existing `store_themes` row.
 *
 * UX:
 *   - Dropdown lists every theme that's eligible to be the default:
 *     status="published" AND flags.installable=true. Ineligible themes
 *     are filtered out client-side so the admin doesn't get a surprise
 *     400 toast after saving. (The server enforces the same gate as a
 *     defence in depth.)
 *   - "— No default —" option clears the value. The yellow info bar
 *     warns that new stores will then fall through to legacy V2.
 *   - Save button disabled until the selection is dirty.
 *
 * Future expansion (file 05 §4 + later phases): this page is a natural
 * home for other platform-wide knobs (default currency, maintenance
 * mode banner, etc.) that aren't already covered by /settings (which
 * targets the `platform_settings` JSONB blob — a different table key).
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAdminThemes,
  type AdminThemeListItem,
} from "@/services/marketplaceAdminApi";
import { Switch } from "@/components/ui/switch";
import {
  getPlatformConfig,
  setAppEmbedsTabEnabled,
  setDefaultTheme,
} from "@/services/platformConfigApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Puzzle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PLATFORM_CONFIG_QUERY_KEY,
  THEMES_QUERY_KEY,
} from "../marketplace/ThemesPage";

// Sentinel value for the Select dropdown — wouter's <Select> can't accept
// an empty string as a SelectItem value (Radix complains). We use a magic
// string and translate to null at save time.
const NO_DEFAULT = "__no_default__";

export default function PlatformSettingsPage() {
  const queryClient = useQueryClient();

  const platformConfigQuery = useQuery({
    queryKey: PLATFORM_CONFIG_QUERY_KEY,
    queryFn: getPlatformConfig,
    staleTime: 30_000,
  });

  // List source — same query the ThemesPage uses so navigating between
  // the two doesn't refetch.
  const themesQuery = useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: listAdminThemes,
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState<string>(NO_DEFAULT);
  useEffect(() => {
    // Keep the local draft in sync with server state until the admin
    // makes a change. Once they change it, the Save button surfaces;
    // the dirty check below uses === against the server value.
    const serverValue =
      platformConfigQuery.data?.default_marketplace_theme_id ?? NO_DEFAULT;
    setDraft(serverValue);
  }, [platformConfigQuery.data?.default_marketplace_theme_id]);

  const mutation = useMutation({
    mutationFn: (next: string | null) => setDefaultTheme(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_CONFIG_QUERY_KEY });
      toast.success("Platform default updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    },
  });

  // Phase 5.2 — App-embeds tab visibility toggle (platform-wide).
  const appEmbedsMutation = useMutation({
    mutationFn: (enabled: boolean) => setAppEmbedsTabEnabled(enabled),
    onSuccess: (snap) => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_CONFIG_QUERY_KEY });
      toast.success(
        snap.app_embeds_tab_enabled
          ? "App embeds tab enabled for merchants"
          : "App embeds tab hidden from merchants",
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    },
  });

  if (platformConfigQuery.isLoading || themesQuery.isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  const themes = themesQuery.data?.themes ?? [];
  // Filter eligibility client-side so the dropdown only shows valid
  // defaults. Server enforces the same gate; this is just a UX
  // shortcut to prevent surprise validation errors.
  const eligibleThemes = themes.filter(
    (t) => t.status === "published" && Boolean(t.flags?.installable),
  );

  const currentServerValue =
    platformConfigQuery.data?.default_marketplace_theme_id ?? NO_DEFAULT;
  const isDirty = draft !== currentServerValue;
  const selectedSummary =
    platformConfigQuery.data?.default_marketplace_theme ?? null;

  const handleSave = () => {
    mutation.mutate(draft === NO_DEFAULT ? null : draft);
  };

  return (
    <DashboardLayout title="Platform settings">
      <div className="p-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Platform settings</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide defaults that apply to NEW stores only. Existing
            stores keep whatever theme they currently have — switching
            this default does not migrate them.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Default theme for new stores</CardTitle>
            <CardDescription>
              When a merchant creates a new store, NUMU installs and
              activates this theme automatically. Choose a theme that's
              both <strong>published</strong> and <strong>installable</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Eligibility warning if no themes qualify. Most likely
                during the soft-migration phase when admins haven't
                flipped any catalog-visible flags yet. */}
            {eligibleThemes.length === 0 ? (
              <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">No eligible themes</p>
                  <p className="text-xs mt-1">
                    A default theme must be both <code>status=published</code>{" "}
                    and have <code>flags.installable=true</code>. Use the{" "}
                    <a
                      href="/marketplace/themes"
                      className="underline underline-offset-2"
                    >
                      Marketplace themes
                    </a>{" "}
                    page to flip those flags first.
                  </p>
                </div>
              </div>
            ) : null}

            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a default…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT}>
                  <span className="text-muted-foreground">— No default —</span>
                </SelectItem>
                {eligibleThemes.map((t) => (
                  <ThemeOption key={t.id} theme={t} />
                ))}
              </SelectContent>
            </Select>

            {/* Empty-state info — explains what null means. Yellow
                because falling through to V2 is a real legacy-fallback
                state, not just "nothing configured". */}
            {draft === NO_DEFAULT && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">New stores will land on legacy V2</p>
                  <p className="text-xs mt-1">
                    Without a marketplace default, new stores fall through
                    to the in-tree V2 "modern" theme. sawsaw + rabbit
                    are already on V2 and stay untouched by this setting.
                  </p>
                </div>
              </div>
            )}

            {/* Current-default summary card — only shows when a default
                is set on the server (not just selected in the dropdown). */}
            {selectedSummary && draft === currentServerValue && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border">
                <Badge variant="secondary">Active</Badge>
                <div className="text-sm">
                  <span className="font-medium">{selectedSummary.name}</span>
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {selectedSummary.slug}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={!isDirty || mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Phase 5.2 — App-embeds tab toggle. Default OFF: the merchant
            theme editor hides the "App embeds" tab until a first-party
            app-embed platform exists, so it never shows a dead feature. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-4 w-4" />
              Theme editor — App embeds tab
            </CardTitle>
            <CardDescription>
              Show the "App embeds" tab in every merchant's theme editor.
              Keep this <strong>off</strong> until a first-party app-embed
              platform ships — otherwise merchants see an empty "Coming
              soon" tab. Affects the editor UI only; no store data changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <p className="font-medium">App embeds tab</p>
                <p className="text-xs text-muted-foreground">
                  {platformConfigQuery.data?.app_embeds_tab_enabled
                    ? "Visible to merchants"
                    : "Hidden from merchants (recommended)"}
                </p>
              </div>
              <Switch
                checked={Boolean(
                  platformConfigQuery.data?.app_embeds_tab_enabled,
                )}
                disabled={appEmbedsMutation.isPending}
                onCheckedChange={(v) => appEmbedsMutation.mutate(v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

/**
 * Single dropdown row — slug + status badge so the admin can tell two
 * themes apart at a glance.
 */
function ThemeOption({ theme }: { theme: AdminThemeListItem }) {
  return (
    <SelectItem value={theme.id}>
      <div className="flex items-center gap-2">
        <span>{theme.name}</span>
        <span className="text-xs text-muted-foreground font-mono">
          {theme.slug}
        </span>
      </div>
    </SelectItem>
  );
}
