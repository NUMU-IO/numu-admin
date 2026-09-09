import type { JSX } from "react";
import type { ReactNode, HTMLAttributes } from "react";

export interface KeyValueItem {
  label: string;
  value: ReactNode;
  /** Renders the value LTR-isolated in mono — IDs, domains, phones, emails, timestamps. */
  mono?: boolean;
}

export interface KeyValueProps extends HTMLAttributes<HTMLDListElement> {
  items: KeyValueItem[];
  layout?: "grid" | "rows";
}

/** Definition list for entity attributes on detail pages. */
export declare function KeyValue(props: KeyValueProps): JSX.Element;
