import type { JSX } from "react";
export interface PaginationProps {
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
  className?: string;
}

/** Range readout + page size + prev/next. Sits inside the table card footer. */
export declare function Pagination(props: PaginationProps): JSX.Element;
