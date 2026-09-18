import type { JSX } from "react";
import type { ReactNode } from "react";

export interface DrawerProps {
  open?: boolean;
  title: ReactNode;
  /** Mono uppercase kicker — usually the entity ID. */
  subtitle?: ReactNode;
  width?: number | string;
  footer?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

/** Side panel for inspecting or editing a record without losing the list behind it. Enters from the inline end, so it mirrors under RTL. */
export declare function Drawer(props: DrawerProps): JSX.Element | null;
