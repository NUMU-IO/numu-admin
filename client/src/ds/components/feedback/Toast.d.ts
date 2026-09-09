import type { JSX } from "react";
import type { ReactNode } from "react";

export interface ToastProps {
  tone?: "success" | "danger" | "info";
  title: ReactNode;
  description?: ReactNode;
  /** An Undo affordance, where the action is reversible. */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Transient confirmation that an action completed. */
export declare function Toast(props: ToastProps): JSX.Element;
/** Fixed bottom-inline-end stack; newest last. */
export declare function ToastStack(props: { children?: ReactNode }): JSX.Element;
