import type { JSX } from "react";
export interface BarDatum {
  label: string;
  value: number;
  /** false hides this bar's axis tick — for sparse labelling on long series. */
  tick?: boolean;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** A --viz-* token. */
  color?: string;
  highlightColor?: string;
  /** Marks out-of-tolerance bars — a spike an operator should look at. */
  isHighlighted?: (d: BarDatum) => boolean;
  formatValue?: (v: number) => string | number;
  showGrid?: boolean;
  gridLines?: number;
  /** Accessible summary of what the chart shows and its trend. */
  label?: string;
  className?: string;
}

/** Monitoring bar chart: horizontal gridlines, tabular tick labels, one accent. */
export declare function BarChart(props: BarChartProps): JSX.Element;
