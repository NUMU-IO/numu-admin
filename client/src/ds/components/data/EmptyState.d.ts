import type { JSX } from "react";
import type { ReactNode } from "react";
import type { NumuIconName } from "../core/Icon";

export interface EmptyStateProps {
  /**
   * empty      nothing exists yet
   * noResults  filters excluded everything
   * error      the request failed
   * denied     the operator lacks the permission
   * offline    the client lost connectivity
   * partial    some upstream data is missing but the page still rendered
   */
  kind?: "empty" | "noResults" | "error" | "denied" | "offline" | "partial";
  icon?: NumuIconName;
  title?: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

/** The six non-happy-path states, in one component so they always read the same. */
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
