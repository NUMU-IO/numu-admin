/**
 * ThemesPage — Session B (2026-05-28).
 *
 * Renamed from `pages/MarketplaceFlags.tsx`. The old file is kept as a
 * one-line re-export so deep links and saved bookmarks via
 * /marketplace/flags continue to land here through the App-level
 * redirect.
 *
 * What's new vs MarketplaceFlags:
 *   1. Inline price chip per theme (Free ↔ N EGP, click to edit) via
 *      ThemePriceInlineEdit + PATCH /marketplace/admin/themes/{id}.
 *   2. Default-theme radio per theme (mutually exclusive across the
 *      table) via DefaultThemeRadio + PATCH /admin/platform-config.
 *
 * What's preserved verbatim from MarketplaceFlags:
 *   - Card-per-theme layout (the file 05 §2.1 table mock is appealing
 *     but the existing card UX is already shipped + tested; switching
 *     layouts would add UI churn unrelated to the user's two asks).
 *   - Three auto-save toggles: catalog_visible, installable, activatable.
 *   - Allowlist + percentage explicit-Save inputs.
 *
 * React Query keys:
 *   - ["admin-marketplace-themes"]    — theme list (already in use)
 *   - ["admin-platform-config"]       — default theme snapshot (new)
 *
 * On mutation success we invalidate both keys: price changes invalidate
 * the themes list (chip refreshes); default changes invalidate the
 * platform config (radio cluster across all rows refreshes). Optimistic
 * updates for the default radio so the previous default radio empties
 * instantly when the admin clicks a new one.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listAdminThemes,
  updateThemeFlags,
  updateThemeMetadata,
  type AdminThemeListItem,
  type ThemeFlags,
} from "@/services/marketplaceAdminApi";
import {
  getPlatformConfig,
  setDefaultTheme,
  type PlatformConfigSnapshot,
} from "@/services/platformConfigApi";
import { Loader2, RefreshCw, EyeOff, Eye, Settings2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ThemePriceInlineEdit } from "./_shared/ThemePriceInlineEdit";
import { DefaultThemeRadio } from "./_shared/DefaultThemeRadio";

// React Query keys — kept module-local so the platform-config page can
// also invalidate them from elsewhere later.
export const THEMES_QUERY_KEY = ["admin-marketplace-themes"] as const;
export const PLATFORM_CONFIG_QUERY_KEY = ["admin-platform-config"] as const;

export default function ThemesPage() {
  const themesQuery = useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: listAdminThemes,
    staleTime: 30_000,
  });

  // Single source of truth for "which theme is the platform default" —
  // shared by every DefaultThemeRadio in the list. One small query for
  // the page, not one per row.
  const platformConfigQuery = useQuery({
    queryKey: PLATFORM_CONFIG_QUERY_KEY,
    queryFn: getPlatformConfig,
    staleTime: 30_000,
  });

  if (themesQuery.isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (themesQuery.isError) {
    const msg =
      themesQuery.error instanceof Error
        ? themesQuery.error.message
        : "Unknown error";
    return (
      <DashboardLayout title="Marketplace themes">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Couldn't load themes</CardTitle>
              <CardDescription>{msg}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const themes = themesQuery.data?.themes ?? [];
  const currentDefaultId =
    platformConfigQuery.data?.default_marketplace_theme_id ?? null;

  return (
    <DashboardLayout title="Marketplace themes">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Marketplace themes</h1>
            <p className="text-sm text-muted-foreground">
              Set price (Free ↔ N EGP), mark a platform default, and flip
              the rollout gates. New themes default to invisible — flip
              catalog_visible to surface them to merchants.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              themesQuery.refetch();
              platformConfigQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {themes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No marketplace themes yet. Submit one via{" "}
              <code>numu-theme submit</code>.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {themes.map((theme) => (
              <ThemeRow
                key={theme.id}
                theme={theme}
                currentDefaultId={currentDefaultId}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface ThemeRowProps {
  theme: AdminThemeListItem;
  currentDefaultId: string | null;
}

function ThemeRow({ theme, currentDefaultId }: ThemeRowProps) {
  const queryClient = useQueryClient();

  // Local edit buffers — typing on every keystroke would thrash the API.
  // Group these behind an explicit Save button (same pattern as the
  // legacy MarketplaceFlags page).
  const [pct, setPct] = useState(
    theme.flags.visible_to_pct?.toString() ?? "0",
  );
  const [allowlist, setAllowlist] = useState(
    (theme.flags.visible_to_user_ids ?? []).join("\n"),
  );

  useEffect(() => {
    setPct(theme.flags.visible_to_pct?.toString() ?? "0");
    setAllowlist((theme.flags.visible_to_user_ids ?? []).join("\n"));
  }, [theme.flags.visible_to_pct, theme.flags.visible_to_user_ids]);

  const flagMutation = useMutation({
    mutationFn: (patch: ThemeFlags) => updateThemeFlags(theme.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THEMES_QUERY_KEY });
      toast.success(`Updated ${theme.name}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  const metadataMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateThemeMetadata>[1]) =>
      updateThemeMetadata(theme.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THEMES_QUERY_KEY });
      toast.success(`Updated ${theme.name}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  // Default-radio mutation has optimistic UX — the previous default
  // empties IMMEDIATELY when the admin clicks a new theme, so the page
  // doesn't feel laggy on the cross-row state flip. Rollback on error
  // restores the prior selection.
  const defaultMutation = useMutation({
    mutationFn: (next: string | null) => setDefaultTheme(next),
    onMutate: async (next: string | null) => {
      await queryClient.cancelQueries({ queryKey: PLATFORM_CONFIG_QUERY_KEY });
      const previous =
        queryClient.getQueryData<PlatformConfigSnapshot>(PLATFORM_CONFIG_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<PlatformConfigSnapshot>(
          PLATFORM_CONFIG_QUERY_KEY,
          {
            ...previous,
            default_marketplace_theme_id: next,
            // Drop the summary block; the refetch on success will hydrate
            // the new theme's metadata. Until then the UI just shows the
            // radio state correctly even without the summary.
            default_marketplace_theme:
              next === theme.id
                ? {
                    id: theme.id,
                    slug: theme.slug,
                    name: theme.name,
                    status: theme.status,
                  }
                : null,
          },
        );
      }
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(PLATFORM_CONFIG_QUERY_KEY, ctx.previous);
      }
      toast.error(err instanceof Error ? err.message : "Couldn't set default");
    },
    onSuccess: (_, next) => {
      if (next === null) {
        toast.success(`Cleared platform default`);
      } else {
        toast.success(`${theme.name} is now the platform default`);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_CONFIG_QUERY_KEY });
    },
  });

  const togglesPatch = (key: keyof ThemeFlags, value: boolean) => {
    flagMutation.mutate({ [key]: value } as ThemeFlags);
  };

  const saveAdvanced = () => {
    const ids = allowlist
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const pctNum = Number.parseInt(pct, 10);
    if (Number.isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
      toast.error("Percentage must be 0–100");
      return;
    }
    flagMutation.mutate({
      visible_to_user_ids: ids,
      visible_to_pct: pctNum,
    });
  };

  const isVisible = Boolean(theme.flags.catalog_visible);
  const isInstallable = Boolean(theme.flags.installable);
  const isActivatable = Boolean(theme.flags.activatable);
  const isPublished = theme.status === "published";

  const anySaving =
    flagMutation.isPending ||
    metadataMutation.isPending ||
    defaultMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              {/* Click the theme name to open the detail editor — five
                  tabs of metadata + screenshots + highlights + versions
                  (Session C). The list page stays focused on the
                  rollout dials (price, default radio, flags). */}
              <Link
                href={`/marketplace/themes/${theme.slug}`}
                className="truncate hover:underline underline-offset-4 decoration-primary/40 transition-colors"
              >
                {theme.name}
              </Link>
              <Link
                href={`/marketplace/themes/${theme.slug}`}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={`Open ${theme.name} detail`}
                title="Open detail editor"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Link>
              {isVisible ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
                  <Eye className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hidden
                </Badge>
              )}
              {/* Replaces the static Free badge with an inline price editor.
                  Clicking the badge opens a number input; blur/Enter
                  commits via PATCH /marketplace/admin/themes/{id}. */}
              <ThemePriceInlineEdit
                priceCents={theme.price_cents}
                // Fall back to EGP when the row was created before the
                // currency column became admin-editable. Bon-younes was
                // created with `currency='USD'` by Session A's migration
                // backfill; per-theme override comes later (Session C
                // metadata editor).
                currency={(theme as unknown as { currency?: string }).currency ?? "USD"}
                onCommit={(nextCents) =>
                  metadataMutation.mutateAsync({ price_cents: nextCents })
                }
                disabled={anySaving}
              />
              {/* Default-theme radio. Mutually exclusive across rows —
                  state lives in the platform-config query, not per-row. */}
              <DefaultThemeRadio
                themeId={theme.id}
                currentDefaultId={currentDefaultId}
                blockedBy={{
                  notPublished: !isPublished,
                  notInstallable: !isInstallable,
                }}
                onSet={(next) => defaultMutation.mutateAsync(next)}
              />
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {theme.slug} · status: {theme.status} · {theme.install_count}{" "}
              installs
            </CardDescription>
          </div>
          {anySaving && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-1" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Auto-save toggles — instant PATCH per change. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ToggleRow
            id={`${theme.id}-catalog`}
            label="Catalog visible"
            help="Appears in the public marketplace browse list."
            checked={isVisible}
            onCheckedChange={(v) => togglesPatch("catalog_visible", v)}
          />
          <ToggleRow
            id={`${theme.id}-install`}
            label="Installable"
            help='"Install" button enabled. Off = preview-only.'
            checked={isInstallable}
            onCheckedChange={(v) => togglesPatch("installable", v)}
          />
          <ToggleRow
            id={`${theme.id}-activate`}
            label="Activatable"
            help='"Activate" enabled. Off = installed but not going live.'
            checked={isActivatable}
            onCheckedChange={(v) => togglesPatch("activatable", v)}
          />
        </div>

        {/* Explicit-save controls — typing here would thrash the API. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor={`${theme.id}-allowlist`}>
              Allowlist (one user-id per line)
            </Label>
            <Textarea
              id={`${theme.id}-allowlist`}
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              rows={3}
              placeholder="8812a566-de31-46c7-aaea-9a98285926­98"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Users in this list see the theme even when "Catalog visible"
              is off. Bypasses the percentage gate too.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${theme.id}-pct`}>
              Rollout percentage (0-100)
            </Label>
            <Input
              id={`${theme.id}-pct`}
              type="number"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Stable per-user hash bucket. Always 100 once rolled out.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={saveAdvanced}
            disabled={flagMutation.isPending}
          >
            Save allowlist + percentage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

function ToggleRow({ id, label, help, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-[11px] text-muted-foreground">{help}</p>
      </div>
    </div>
  );
}
