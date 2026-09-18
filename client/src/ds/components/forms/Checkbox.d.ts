import type { JSX } from "react";
import type { ReactNode, InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  /** Partial selection — the header checkbox of a partly-selected table. */
  indeterminate?: boolean;
  /** Drops the 44px row height. Only inside table cells, which own their own row height. */
  compact?: boolean;
}

/** Checkbox with label, for multi-select and boolean settings. */
export declare function Checkbox(props: CheckboxProps): JSX.Element;
