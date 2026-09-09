import type { JSX } from "react";
import type { ReactNode } from "react";

export interface SavedView { id: string; label: string }

export interface FilterBarProps {
  /** Operator-saved filter sets, e.g. "High-risk COD", "Trials ending". */
  savedViews?: SavedView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls — Selects, Chips, date ranges. */
  children?: ReactNode;
  /** Right-hand cluster. Defaults to Columns + Export CSV. */
  actions?: ReactNode;
  /** > 0 swaps the whole bar for the bulk-action toolbar. */
  selectedCount?: number;
  bulkActions?: ReactNode;
  onClearSelection?: () => void;
  className?: string;
}

/** Table toolbar: saved views, scoped search, filters, column config, export — and the bulk-action state. */
export declare function FilterBar(props: FilterBarProps): JSX.Element;
