import type { JSX } from "react";
import type { ReactNode } from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  /** Renders label + switch as a full-width row. Omit for a bare control in a table cell. */
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Immediate-effect toggle — feature flags, integrations, store settings. */
export declare function Switch(props: SwitchProps): JSX.Element;
