import type { JSX } from "react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** A <Breadcrumbs> element. Required on every entity detail page. */
  breadcrumbs?: ReactNode;
  title: ReactNode;
  /** StatusBadges belonging to the entity itself. */
  badges?: ReactNode;
  /** Mono facts line — IDs, plan, created date, region. */
  meta?: ReactNode;
  /** Actions scoped to THIS entity level only. Never mix org-level and store-level actions here. */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Page/entity header: hierarchy, name, status, identifying facts and scoped actions. */
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
