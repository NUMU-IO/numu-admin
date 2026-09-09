import type { JSX } from "react";
export interface Crumb { id?: string; label: string }

export interface BreadcrumbsProps {
  /** Always the real entity chain: Organizations › Rahab Group › Rahab Boutique › Order #… */
  items: Crumb[];
  onNavigate?: (id?: string) => void;
  className?: string;
}

/** Entity-hierarchy trail. Separators mirror under RTL. */
export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;
