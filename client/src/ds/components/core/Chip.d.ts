import type { JSX } from "react";
import type { ReactNode, ButtonHTMLAttributes, MouseEvent } from "react";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  selected?: boolean;
  variant?: "solid" | "outline";
  /** Result count for this facet, rendered in mono. */
  count?: number;
  /** Shows the dismiss affordance. Applied filters get it; toggle chips do not. */
  onRemove?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
  children?: ReactNode;
}

/** Toggleable filter chip / applied-filter token. */
export declare function Chip(props: ChipProps): JSX.Element;
