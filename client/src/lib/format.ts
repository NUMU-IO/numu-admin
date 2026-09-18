/**
 * Number, money and time formatting for the admin.
 *
 * Two rules from the design system are encoded here rather than left to
 * each call site. Latin digits everywhere, because operators cross-reference
 * against logs and CSV exports. And money is always rendered from the minor
 * unit the API stores — every `total`, `balance` and `mrr` on the wire is an
 * integer of piasters, so a helper that takes major units would silently be
 * 100× wrong.
 */

const NUM = new Intl.NumberFormat("en-US");

const MONEY = new Map<string, Intl.NumberFormat>();

function money(currency: string, decimals: 0 | 2): Intl.NumberFormat {
  const key = `${currency}:${decimals}`;
  let f = MONEY.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-EG", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    MONEY.set(key, f);
  }
  return f;
}

export function formatNumber(n: number | null | undefined): string {
  return NUM.format(n ?? 0);
}

/** Minor units → `EGP 1,240.00`. Pass the row's own currency where it has one. */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency = "EGP",
): string {
  return money(currency, 2).format((minorUnits ?? 0) / 100);
}

/** Minor units → `EGP 1,240`. For metric tiles, where the decimals are noise. */
export function formatMoneyShort(
  minorUnits: number | null | undefined,
  currency = "EGP",
): string {
  return money(currency, 0).format((minorUnits ?? 0) / 100);
}

/** Signed percentage for a MetricCard delta. Returns undefined at zero. */
export function formatDelta(pct: number | null | undefined): string | undefined {
  if (pct == null || pct === 0) return undefined;
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "4 minutes ago" / "in 3 days" — for freshness lines and audit rows. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let amount = seconds;
  for (const [unit, span] of steps) {
    if (Math.abs(amount) < span) return rtf.format(Math.round(amount), unit);
    amount /= span;
  }
  return rtf.format(Math.round(amount), "year");
}

/** 35402 → "35.4k". For chart axis ticks, whose gutter is 34px wide. */
export function formatCompact(n: number | null | undefined): string {
  const v = n ?? 0;
  if (Math.abs(v) < 1000) return String(v);
  if (Math.abs(v) < 1_000_000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}
