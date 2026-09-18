import type { JSX } from "react";
import type { ReactNode } from "react";
import type { NumuIconName } from "../core/Icon";

export interface BannerProps {
  /** impersonation = the full-width Saffron "view as merchant" warning. */
  tone?: "info" | "success" | "warning" | "danger" | "impersonation";
  title?: ReactNode;
  /** Square edges, no side borders — for a bar pinned under the topbar. */
  bar?: boolean;
  icon?: NumuIconName;
  actions?: ReactNode;
  onDismiss?: () => void;
  children?: ReactNode;
  className?: string;
}

/** Persistent in-page message: partial data, degraded service, impersonation, permission notices. */
export declare function Banner(props: BannerProps): JSX.Element;
