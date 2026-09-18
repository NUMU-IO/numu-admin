import type { JSX } from "react";
import type { ReactNode } from "react";
import type { NumuIconName } from "../core/Icon";

export interface NavItem {
  id: string;
  label: string;
  icon: NumuIconName;
  /** Queue depth / open count. Numbers only where the operator can act on them. */
  count?: number;
  /** Renders the count in Terracotta — something is breaching. */
  alert?: boolean;
}

export interface NavSection {
  /** Mono uppercase group heading. Omit for the first, unlabelled group. */
  label?: string;
  items: NavItem[];
}

export interface SidebarNavProps {
  sections: NavSection[];
  active?: string;
  onNavigate?: (id: string) => void;
  /** Environment tag beside the wordmark — "prod", "staging". Always show it in an internal tool. */
  env?: string;
  /** Icon-only rail. The tablet default below 1100px. */
  collapsed?: boolean;
  footer?: ReactNode;
  className?: string;
}

/** Navy primary navigation rail for the internal admin. */
export declare function SidebarNav(props: SidebarNavProps): JSX.Element;
