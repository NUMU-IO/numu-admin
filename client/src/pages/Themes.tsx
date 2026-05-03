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
  clearThemePreview,
  listThemeAdminConfig,
  uploadThemePreview,
  type RequiredPlan,
  type ThemeAdminConfigItem,
  type ThemeAdminConfigPatch,
} from "@/services/themeAdminApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Loader2, Palette, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
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
const fallbackPreviewUrl = (slug: string) =>
  `${PREVIEW_BASE}/themes/${slug}/preview.png`;
// Resolve the URL to display in the thumbnail: the admin-uploaded override
// takes precedence; otherwise we try the convention path. Cache-busts on
// override so a fresh upload renders without a hard reload.
const previewUrlFor = (theme: ThemeAdminConfigItem) =>
  theme.preview_image_url ?? fallbackPreviewUrl(theme.theme_slug);

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

  // Per-row upload tracker — keyed by slug so two uploads in flight don't
  // share a spinner / get confused with each other.
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);

  // Upload writes directly to the backend (no diff/save dance) — the file
  // landing in object storage is the side effect, the row update is the
  // confirmation. We sync both query data + draft so an in-progress edit
  // session sees the new preview URL.
  const uploadMutation = useMutation({
    mutationFn: ({ slug, file }: { slug: string; file: File }) =>
      uploadThemePreview(slug, file),
    onMutate: ({ slug }) => {
      setUploadingSlug(slug);
    },
    onSuccess: (saved) => {
      mergeRow(saved);
      toast.success(`${saved.name}: preview uploaded`);
    },
    onError: (err) =>
      toast.error((err as Error).message || "Upload failed"),
    onSettled: () => setUploadingSlug(null),
  });

  const clearMutation = useMutation({
    mutationFn: (slug: string) => clearThemePreview(slug),
    onMutate: (slug) => {
      setUploadingSlug(slug);
    },
    onSuccess: (saved) => {
      mergeRow(saved);
      toast.success(`${saved.name}: preview cleared`);
    },
    onError: (err) =>
      toast.error((err as Error).message || "Failed to clear preview"),
    onSettled: () => setUploadingSlug(null),
  });

  // Merge a single updated row into both the canonical query cache and
  // the local draft so unsaved flag edits are preserved.
  const mergeRow = (saved: ThemeAdminConfigItem) => {
    const merge = (list: ThemeAdminConfigItem[]) =>
      list.map((t) => (t.theme_slug === saved.theme_slug ? saved : t));
    queryClient.setQueryData<ThemeAdminConfigItem[]>(
      ["admin-themes"],
      (prev) => (prev ? merge(prev) : prev),
    );
    setDraft((prev) => (prev ? merge(prev) : prev));
  };

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
                    onUpload={(file) =>
                      uploadMutation.mutate({ slug: theme.theme_slug, file })
                    }
                    onClear={() => clearMutation.mutate(theme.theme_slug)}
                    isUploading={uploadingSlug === theme.theme_slug}
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
  onUpload: (file: File) => void;
  onClear: () => void;
  isUploading: boolean;
}

function ThemeRow({
  theme,
  onChange,
  onUpload,
  onClear,
  isUploading,
}: ThemeRowProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Reset broken-image state whenever the URL changes (post-upload).
  // Without this, an upload after an `onError` would leave the placeholder.
  const previewUrl = previewUrlFor(theme);
  const hasOverride = !!theme.preview_image_url;

  const handlePick = () => fileInputRef.current?.click();
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = "";
    if (f) {
      setImgFailed(false);
      onUpload(f);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[88px_1fr_auto] gap-4 py-4 items-center">
      {/* Thumbnail — click to upload */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handlePick}
          disabled={isUploading}
          aria-label={`Upload preview for ${theme.name}`}
          className="group relative w-22 h-14 sm:w-22 sm:h-14 rounded-md overflow-hidden bg-muted border border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {imgFailed ? (
            <ImageOff className="w-5 h-5 text-muted-foreground" />
          ) : (
            <img
              key={previewUrl}
              src={previewUrl}
              alt={theme.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          )}
          {/* Hover overlay — visible on focus too for keyboard users */}
          <span className="absolute inset-0 bg-foreground/55 text-background flex items-center justify-center gap-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Upload className="w-3 h-3" />
                Upload
              </>
            )}
          </span>
        </button>
        {hasOverride ? (
          <button
            type="button"
            onClick={onClear}
            disabled={isUploading}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label={`Upload preview screenshot for ${theme.name}`}
          onChange={handleFile}
        />
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
          {hasOverride ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-500/30 bg-emerald-500/5 text-[10px]">
              Custom preview
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
