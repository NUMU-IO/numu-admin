import type { JSX } from "react";
import type { CSSProperties } from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  /** >1 renders a stack of lines with a short last line. */
  lines?: number;
  variant?: "text" | "block";
  className?: string;
  style?: CSSProperties;
}

/** Shimmer placeholder. Always sized to the real content so nothing reflows. */
export declare function Skeleton(props: SkeletonProps): JSX.Element;
