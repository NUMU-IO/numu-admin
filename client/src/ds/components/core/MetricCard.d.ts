import type { JSX } from "react";
import type { ReactNode, HTMLAttributes } from "react";
import type { NumuIconName } from "./Icon";

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  /** EGP, %, orders — set in mono next to the value, never inside it. */
  unit?: string;
  /** Signed change string, e.g. "+12.4%" or "-3". */
  delta?: string;
  /** Force the direction when "up" is bad (failed payments, chargebacks). */
  deltaDirection?: "up" | "down" | "flat";
  note?: string;
  icon?: NumuIconName;
  /** Terracotta edge — the metric is out of tolerance and needs an operator. */
  alert?: boolean;
  loading?: boolean;
  /** A <Sparkline> to sit beside the value. */
  sparkline?: ReactNode;
  flat?: boolean;
  onClick?: () => void;
}

/**
 * Single operational number with change, note and optional sparkline.
 * @startingPoint section="Admin" subtitle="Operational metric tile with delta and sparkline" viewport="700x150"
 */
export declare function MetricCard(props: MetricCardProps): JSX.Element;
