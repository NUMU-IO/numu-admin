import type { JSX } from "react";
import type { ReactNode } from "react";

export interface DataTableColumn<Row = any> {
  key: string;
  header: ReactNode;
  /** "end" for numeric/currency columns — right-aligned and tabular. */
  align?: "start" | "end";
  /** Mono + LTR-isolated: IDs, timestamps, references, phone numbers. */
  mono?: boolean;
  sortable?: boolean;
  width?: string | number;
  skeletonWidth?: string;
  cellClassName?: string;
  render?: (row: Row, index: number) => ReactNode;
}

export interface DataTableProps<Row = any> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** 36px rows instead of 44px — for queues an operator scans all day. */
  dense?: boolean;
  rowKey?: (row: Row, index: number) => string | number;
  selectable?: boolean;
  selected?: Array<string | number>;
  onSelect?: (key: string | number) => void;
  onSelectAll?: (checked: boolean) => void;
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
  loading?: boolean;
  skeletonRows?: number;
  /** Rendered in place of the table body when rows is empty — pass an <EmptyState>. */
  empty?: ReactNode;
  /** Screen-reader caption describing what the table lists. */
  caption?: string;
  /** Row-level attention marker: paints a Terracotta edge on the leading cell. */
  isFlagged?: (row: Row) => boolean;
  onRowClick?: (row: Row) => void;
  className?: string;
}

/**
 * Dense operational table with sorting, selection, loading and empty states.
 * @startingPoint section="Admin" subtitle="Sortable, selectable dense data table" viewport="700x300"
 */
export declare function DataTable<Row = any>(props: DataTableProps<Row>): JSX.Element;
