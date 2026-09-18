import type { JSX } from "react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { NumuIconName } from "./Icon";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** primary = the one expected action per view. Never two primaries on a screen. */
  variant?: "primary" | "accent" | "outline" | "subtle" | "ghost" | "danger" | "danger-outline";
  /** sm for table/toolbar rows, md default (40px), lg for marketing heroes. */
  size?: "sm" | "md" | "lg";
  icon?: NumuIconName;
  iconEnd?: NumuIconName;
  /** Fully rounded — chips, tier pills and editorial CTAs only. */
  pill?: boolean;
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Permission key this action needs, e.g. "stores.impersonate". */
  requiresPermission?: string;
  /** When false and requiresPermission is set, the button locks and explains why. */
  hasPermission?: boolean;
  as?: "button" | "a";
  /** Anchor attributes, valid only with `as="a"`. The component already
      spreads unknown props onto the element; the upstream types just did
      not declare them. */
  href?: string;
  target?: string;
  rel?: string;
  children?: ReactNode;
}

/**
 * NUMU action button covering the full action hierarchy.
 * @startingPoint section="Core" subtitle="Action hierarchy, sizes and states" viewport="700x220"
 */
export declare function Button(props: ButtonProps): JSX.Element;
