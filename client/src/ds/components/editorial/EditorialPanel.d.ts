import type { JSX } from "react";
import type { ReactNode, HTMLAttributes } from "react";

export interface EditorialPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Mono Sienna label that peeks above the top edge — the brand's signature panel detail. */
  peekLabel?: string;
  kicker?: string;
  title?: ReactNode;
  children?: ReactNode;
}

/** Warm hairline panel with the peek label. Marketing and deck surfaces only. */
export declare function EditorialPanel(props: EditorialPanelProps): JSX.Element;
