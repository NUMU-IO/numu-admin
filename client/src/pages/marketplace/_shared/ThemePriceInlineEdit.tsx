/**
 * ThemePriceInlineEdit — Shopify-style inline price chip.
 *
 * Default presentation is a Badge:
 *   - "Free" (mint) when `price_cents === 0`
 *   - "{N} EGP" (slate) otherwise
 *
 * Click the badge → editor input. Blur or Enter commits via
 * `onCommit({ price_cents: <new> })`; Escape rolls back. The commit
 * function is expected to delegate to `updateThemeMetadata` so the
 * server validates `price_cents >= 0` and the currency whitelist.
 *
 * We deliberately don't wire React Query in here — the parent owns the
 * mutation so the same TanStack cache key gets invalidated as the
 * default-radio mutation and the flag toggles. Keeping this component
 * pure makes it trivially reusable in the future detail page too.
 */

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Gift } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ThemePriceInlineEditProps {
  priceCents: number;
  currency: string;
  /** Commit a new price (in cents). Returns once the server has saved. */
  onCommit: (nextCents: number) => Promise<unknown>;
  /** Optional: disable editing entirely (e.g. row is mid-save elsewhere). */
  disabled?: boolean;
}

export function ThemePriceInlineEdit({
  priceCents,
  currency,
  onCommit,
  disabled,
}: ThemePriceInlineEditProps) {
  // EGP-equivalent integer display. We work in EGP whole units in the
  // input box to keep things obvious for the admin — the cents/EGP
  // conversion happens at commit time. (price_cents = 5000 → 50 EGP.)
  const [editing, setEditing] = useState(false);
  const [draftWhole, setDraftWhole] = useState(
    () => Math.round(priceCents / 100).toString(),
  );
  const [saving, setSaving] = useState(false);
  const lastCommitted = useRef(priceCents);

  // If the server-side price changes (cache invalidate, optimistic update,
  // rollback), reset the editor draft so the next time we click the badge
  // we start from the truth.
  useEffect(() => {
    if (priceCents !== lastCommitted.current) {
      setDraftWhole(Math.round(priceCents / 100).toString());
      lastCommitted.current = priceCents;
    }
  }, [priceCents]);

  const isFree = priceCents === 0;

  const commit = async () => {
    const parsed = Number.parseInt(draftWhole, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      // Roll back the draft text — the server-side validator would
      // reject anyway, but a friendly local guard saves a round-trip.
      setDraftWhole(Math.round(priceCents / 100).toString());
      setEditing(false);
      return;
    }
    const nextCents = parsed * 100;
    // Same-value commits are a common accident; don't fire a no-op
    // server roundtrip.
    if (nextCents === priceCents) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(nextCents);
      lastCommitted.current = nextCents;
    } catch {
      // Parent should toast; roll back here.
      setDraftWhole(Math.round(priceCents / 100).toString());
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          if (!disabled && !saving) setEditing(true);
        }}
        disabled={disabled || saving}
        className="inline-flex items-center gap-1 outline-none rounded-md focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        title={disabled ? undefined : "Click to edit price"}
      >
        {isFree ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
            <Gift className="h-3 w-3 mr-1" />
            Free
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-mono">
            {Math.round(priceCents / 100)} {currency}
          </Badge>
        )}
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        type="number"
        min={0}
        step={1}
        value={draftWhole}
        onChange={(e) => setDraftWhole(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraftWhole(Math.round(priceCents / 100).toString());
            setEditing(false);
          }
        }}
        className="h-7 w-24 font-mono"
        aria-label={`Price in ${currency}`}
      />
      <span className="text-xs text-muted-foreground">{currency}</span>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}
