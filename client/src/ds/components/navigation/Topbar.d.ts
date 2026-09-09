import type { JSX } from "react";
import type { ReactNode } from "react";

export interface TopbarProps {
  /** Opens the CommandPalette. The search field is a button, not an input — one search surface only. */
  onSearchOpen?: () => void;
  searchPlaceholder?: string;
  shortcut?: string;
  actions?: ReactNode;
  /** Role is always shown: operators need to know which permissions they are acting under. */
  user?: { name: string; initials: string; role: string };
  /** Tablet hamburger. Provide below 1100px. */
  onMenu?: () => void;
  className?: string;
}

/** Application topbar: global search entry, contextual actions, current operator and role. */
export declare function Topbar(props: TopbarProps): JSX.Element;
