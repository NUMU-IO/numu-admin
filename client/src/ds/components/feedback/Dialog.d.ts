import type { JSX } from "react";
import type { ReactNode } from "react";
import type { NumuIconName } from "../core/Icon";

export interface DialogProps {
  open?: boolean;
  tone?: "neutral" | "warning" | "danger";
  icon?: NumuIconName;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

/** Modal for a focused decision or a short form. Closes on Escape and scrim click. */
export declare function Dialog(props: DialogProps): JSX.Element | null;
