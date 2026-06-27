/**
 * DefaultThemeRadio — mutually-exclusive "set as platform default" radio.
 *
 * Reads `default_marketplace_theme_id` from the cached platform config,
 * compares against the supplied `themeId`. Clicking flips via
 * `setDefaultTheme(themeId)`; clicking the already-active radio clears
 * via `setDefaultTheme(null)`.
 *
 * Server-side validation:
 *   - Theme must be `status="published"` AND `flags.installable=true`.
 *     The component pre-disables when those preconditions fail so the
 *     admin gets a clear hover hint instead of a surprise 400 toast.
 *
 * Why a `<button role="radio">` not native `<input type="radio">`:
 *   - Native radios force a single `<form>` ownership and lose styling
 *     consistency with the rest of the admin UI. shadcn doesn't ship a
 *     "row-level radio" pattern, so the button + ARIA role pattern is
 *     the cleanest fit.
 */

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export interface DefaultThemeRadioProps {
  themeId: string;
  currentDefaultId: string | null;
  /** Reasons the theme CAN'T be default (drives the disabled state + tooltip). */
  blockedBy?: {
    notPublished?: boolean;
    notInstallable?: boolean;
  };
  /**
   * Set or clear the platform default. Called with `themeId` to set,
   * `null` to clear (when the current radio is clicked again).
   */
  onSet: (next: string | null) => Promise<unknown>;
}

export function DefaultThemeRadio({
  themeId,
  currentDefaultId,
  blockedBy,
  onSet,
}: DefaultThemeRadioProps) {
  const [saving, setSaving] = useState(false);
  const isDefault = currentDefaultId === themeId;
  const blockedReason = blockedBy?.notPublished
    ? "Theme must be published before it can be the platform default."
    : blockedBy?.notInstallable
      ? "Theme must be marked installable to be the platform default."
      : null;
  const disabled = !!blockedReason || saving;

  const onClick = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await onSet(isDefault ? null : themeId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isDefault}
      aria-label={isDefault ? "Platform default theme" : "Set as platform default"}
      title={blockedReason ?? (isDefault ? "Currently the platform default" : "Set as platform default")}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
        // Active (current default) — solid primary chip
        isDefault &&
          "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90",
        // Available (clickable) — outline that fills on hover
        !isDefault &&
          !disabled &&
          "border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/40",
        // Blocked — strikethrough-ish with lock cue from tooltip
        !isDefault &&
          disabled &&
          "border-dashed border-border/70 text-muted-foreground/60 cursor-not-allowed",
      )}
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            isDefault
              ? "bg-primary-foreground"
              : "bg-transparent border border-current",
          )}
        />
      )}
      {isDefault ? "Default" : "Set default"}
    </button>
  );
}
