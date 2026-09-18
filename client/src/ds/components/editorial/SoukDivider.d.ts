import type { JSX } from "react";
import type { CSSProperties } from "react";

export interface SoukDividerProps {
  tone?: "sienna" | "navy";
  /** Tile height in px. 44 is the drawn tile; scale both axes together. */
  height?: number;
  opacity?: number;
  /** Mirrors vertically — pair a flipped strip with an upright one to frame a band. */
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Repeating Souk tile strip for section edges and framed bands. */
export declare function SoukDivider(props: SoukDividerProps): JSX.Element;
