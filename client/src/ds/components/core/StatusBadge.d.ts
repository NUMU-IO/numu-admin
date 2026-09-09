import type { JSX } from "react";
import type { BadgeProps } from "./Badge";
import type { NumuIconName } from "./Icon";

export type NumuStatus =
  | "active" | "paid" | "shipped" | "delivered" | "healthy" | "resolved" | "verified"
  | "trial" | "draft" | "open" | "new"
  | "pending" | "in_review" | "degraded" | "past_due" | "low_stock" | "retrying"
  | "failed" | "refunded" | "suspended" | "chargeback" | "down"
  | "cancelled" | "archived" | "churned" | "closed";

export interface StatusBadgeProps extends Omit<BadgeProps, "tone" | "children"> {
  status: NumuStatus;
  /** Override the display word — e.g. an Arabic label. Tone and glyph stay bound to `status`. */
  label?: string;
  /** Pass null to suppress the glyph. */
  icon?: NumuIconName | null;
}

/** Lifecycle status pill bound to the platform's shared status vocabulary. */
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
export declare const NUMU_STATUS: Record<NumuStatus, { tone: string; icon: NumuIconName | null; label: string }>;
