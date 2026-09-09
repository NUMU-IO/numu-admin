import type { JSX } from "react";
import type { ReactNode } from "react";

export interface TooltipProps {
  label: ReactNode;
  /** Mono — full timestamps, IDs, truncated technical values. */
  mono?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Hover/focus label. Opens on keyboard focus too, so it is never mouse-only. */
export declare function Tooltip(props: TooltipProps): JSX.Element;
