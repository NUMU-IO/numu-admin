import type { JSX } from "react";
import type { ReactNode } from "react";
import type { KeyValueItem } from "../core/KeyValue";

export interface ConfirmDialogProps {
  open?: boolean;
  title: ReactNode;
  /** Identifies exactly what is being acted on — never rely on page context. */
  entity?: KeyValueItem[];
  /** Plain-language list of what will happen. One line per consequence. */
  consequences?: string[];
  confirmLabel?: string;
  /** Typed-confirmation gate for irreversible actions — usually the entity name or ID. */
  confirmPhrase?: string;
  tone?: "danger" | "warning";
  /** Prints the "recorded in the audit log" line. Leave on for staff actions. */
  auditNote?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}

/** Destructive-action confirmation with entity identification, consequences and typed gate. */
export declare function ConfirmDialog(props: ConfirmDialogProps): JSX.Element;
