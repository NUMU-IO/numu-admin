import type { JSX } from "react";
export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** A --viz-* token. Default --viz-2. Never encode status here — use the metric's own alert flag. */
  color?: string;
  area?: boolean;
  strokeWidth?: number;
  /** Accessible summary, e.g. "Orders per hour, last 24h, trending up". */
  label?: string;
}

/** Axis-free trend line for a metric tile or table cell. */
export declare function Sparkline(props: SparklineProps): JSX.Element | null;
