/**
 * Themes Page — NUMU Admin Dashboard
 *
 * Per-theme global flags: visibility, required plan, display order.
 * Settings are global (apply to every merchant); the storefront API
 * decorates `GET /storefront/themes` with these so merchants see the
 * filtered/decorated list. The catalog of theme slugs lives in the
 * storefront route module — this page only edits the admin flags.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getLoginUrl } from "@/const";
import {
  batchUpdateThemeAdminConfig,
  listThemeAdminConfig,
  type RequiredPlan,
  type ThemeAdminConfigItem,
  type ThemeAdminConfigPatch,
} from "@/services/themeAdminApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Loader2, Palette } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PLAN_OPTIONS: { value: RequiredPlan; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

// Same convention as the backend's STOREFRONT_ASSETS_BASE_URL default.
// Falls back to placeholder via <img onError> if the asset isn't deployed.
const PREVIEW_BASE = "https://numueg.app";
const previewUrlFor = (slug: string) => `${PREVIEW_BASE}/themes/${slug}/preview.png`;

export default function Themes() {
  const { loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const themesQuery = useQuery({
    queryKey: ["admin-themes"],
    queryFn: listThemeAdminConfig,
    enabled: isAuthenticated,
  });

  const [draft, setDraft] = useState<ThemeAdminConfigItem[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Seed the draft once when server data arrives. Subsequent server refetches
  // (e.g. window focus) won't clobber an in-progress edit because we keep
  // ``draft`` populated until the next save.
  if (draft === null && themesQuery.data) {
    setDraft(themesQuery.data);
  }

  const themes = draft ?? themesQuery.data ?? [];

  const setField = <K extends keyof ThemeAdminConfigItem>(
    slug: string,
    key: K,
    value: ThemeAdminConfigItem[K],
  ) => {
    setDraft((prev) => {
      const base = prev ?? themesQuery.data ?? [];
      return base.map((t) =>
        t.theme_slug === slug ? { ...t, [key]: value } : t,
      );
    });
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: (patches: ThemeAdminConfigPatch[]) =>
      batchUpdateThemeAdminConfig(patches),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin-themes"], saved);
      setDraft(saved);
      setIsDirty(false);
      toast.success("Themes saved");
    },
    onError: (err) =>
      toast.error((err as Error).message || "Failed to save themes"),
  });

  const handleSave = () => {
    if (!draft || !themesQuery.data) return;
    const original = new Map(
      themesQuery.data.map((t) => [t.theme_slug, t] as const),
    );
    const patches: ThemeAdminConfigPatch[] = [];
    for (const item of draft) {
      const ref = original.get(item.theme_slug);
      if (!ref) continue;
      const patch: ThemeAdminConfigPatch = { theme_slug: item.theme_slug };
      let hasChange = false;
      if (item.is_visible !== ref.is_visible) {
        patch.is_visible = item.is_visible;
        hasChange = true;
      }
      if (item.required_plan !== ref.required_plan) {
        patch.required_plan = item.required_plan;
        hasChange = true;
      }
      if (item.display_order !== ref.display_order) {
        patch.display_order = item.display_order;
        hasChange = true;
      }
      if (hasChange) patches.push(patch);
    }
    if (patches.length === 0) {
      toast.message("Nothing to save");
      return;
    }
    saveMutation.mutate(patches);
  };

  const saving = saveMutation.isPending;

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
      return <DashboardLayoutSkeleton />;
    }
  }

  return (
    <DashboardLayout
      title="Themes"
      subtitle="Control which storefront themes appear in the merchant theme picker and which plan tier they require"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Storefront Themes
              </CardTitle>
              <CardDescription>
                Hide work-in-progress themes, gate premium themes behind a
                plan tier, and control the order they appear in the merchant
                grid.
              </CardDescription>
            </div>
            <Button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="shrink-0"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </CardHeader>
          <CardContent>
            {themesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading themes…
              </div>
            ) : themesQuery.isError ? (
              <div className="py-12 text-center text-destructive">
                Failed to load themes — try refreshing the page.
              </div>
            ) : themes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No themes registered.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {themes.map((theme) => (
                  <ThemeRow
                    key={theme.theme_slug}
                    theme={theme}
                    onChange={setField}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface ThemeRowProps {
  theme: ThemeAdminConfigItem;
  onChange: <K extends keyof ThemeAdminConfigItem>(
    slug: string,
    key: K,
    value: ThemeAdminConfigItem[K],
  ) => void;
}

function ThemeRow({ theme, onChange }: ThemeRowProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[88px_1fr_auto] gap-4 py-4 items-center">
      {/* Thumbnail */}
      <div className="w-22 h-14 sm:w-22 sm:h-14 rounded-md overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
        {imgFailed ? (
          <ImageOff className="w-5 h-5 text-muted-foreground" />
        ) : (
          <img
            src={previewUrlFor(theme.theme_slug)}
            alt={theme.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}
      </div>

      {/* Name + slug + ar */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{theme.name}</p>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {theme.theme_slug}
          </Badge>
          {!theme.is_visible ? (
            <Badge variant="outline" className="text-muted-foreground">
              Hidden
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground truncate" dir="rtl">
          {theme.name_ar}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id={`visible-${theme.theme_slug}`}
            checked={theme.is_visible}
            onCheckedChange={(v) => onChange(theme.theme_slug, "is_visible", v)}
          />
          <Label
            htmlFor={`visible-${theme.theme_slug}`}
            className="text-sm cursor-pointer"
          >
            Visible
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Label
            htmlFor={`plan-${theme.theme_slug}`}
            className="text-sm whitespace-nowrap"
          >
            Plan
          </Label>
          <Select
            value={theme.required_plan}
            onValueChange={(v) =>
              onChange(theme.theme_slug, "required_plan", v as RequiredPlan)
            }
          >
            <SelectTrigger
              id={`plan-${theme.theme_slug}`}
              className="w-[130px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label
            htmlFor={`order-${theme.theme_slug}`}
            className="text-sm whitespace-nowrap"
          >
            Order
          </Label>
          <Input
            id={`order-${theme.theme_slug}`}
            type="number"
            min={0}
            max={10000}
            value={theme.display_order}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange(theme.theme_slug, "display_order", n);
            }}
            className="w-[88px]"
          />
        </div>
      </div>
    </div>
  );
}
