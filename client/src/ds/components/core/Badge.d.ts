import type { JSX } from "react";
import type { ReactNode, HTMLAttributes } from "react";
import type { NumuIconName } from "./Icon";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "solid";
  /** Glyph reinforcing the tone. Required by the "never colour alone" rule when the label is ambiguous. */
  icon?: NumuIconName;
  dot?: boolean;
  /** 4px corners instead of a pill — for inline metadata tags. */
  square?: boolean;
  children?: ReactNode;
}

/** Mono, uppercase, tracked status pill. */
export declare function Badge(props: BadgeProps): JSX.Element;
