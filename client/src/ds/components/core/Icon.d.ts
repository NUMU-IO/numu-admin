import type { JSX } from "react";
import type { CSSProperties } from "react";

export type NumuIconName =
  | "store" | "package" | "cart" | "truck" | "barChart" | "plus" | "minus"
  | "check" | "x" | "chevronRight" | "chevronLeft" | "chevronDown" | "chevronUp"
  | "arrowRight" | "arrowLeft" | "arrowUp" | "arrowDown" | "arrowUpRight"
  | "search" | "bell" | "tag" | "eye" | "eyeOff" | "layout" | "building"
  | "users" | "user" | "userPlus" | "shield" | "shieldAlert" | "alertTriangle"
  | "alertCircle" | "info" | "activity" | "creditCard" | "banknote"
  | "messageCircle" | "plug" | "toggleLeft" | "flag" | "fileText" | "clipboard"
  | "clock" | "calendar" | "refresh" | "download" | "upload" | "filter"
  | "settings" | "sliders" | "moreVertical" | "moreHorizontal" | "menu" | "externalLink"
  | "logOut" | "trash" | "lock" | "zap" | "server" | "database" | "gitBranch"
  | "wifiOff" | "inbox" | "megaphone" | "command" | "globe" | "mapPin"
  | "phone" | "mail" | "warehouse" | "trendingUp" | "trendingDown" | "history"
  | "playCircle" | "pauseCircle" | "copy" | "link" | "star" | "circle" | "slash";

export interface IconProps {
  /** Lucide glyph name from the NUMU set. */
  name: NumuIconName;
  /** Box size in px. 16 dense tables, 18 UI default, 20 nav, 24 specimen. */
  size?: number;
  /** Stroke weight. Always 1.5 unless a spec says otherwise. */
  strokeWidth?: number;
  /** Accessible name. Omit for decorative icons — they get aria-hidden. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Lucide outline icon at NUMU's 1.5px stroke, inheriting currentColor. */
export declare function Icon(props: IconProps): JSX.Element | null;
export declare const NUMU_ICONS: Record<string, string>;
