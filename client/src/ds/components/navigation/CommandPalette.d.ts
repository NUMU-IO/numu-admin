import type { JSX } from "react";
import type { NumuIconName } from "../core/Icon";

export interface PaletteItem {
  id: string;
  label: string;
  icon: NumuIconName;
  /** The matched identifier — order ID, phone, domain, email. Printed mono/LTR. */
  meta?: string;
  /** Entity type word: STORE, ORDER, USER, ORG, ACTION. */
  kind?: string;
}

export interface PaletteGroup { label: string; items: PaletteItem[] }

export interface CommandPaletteProps {
  open?: boolean;
  query?: string;
  onQueryChange?: (q: string) => void;
  /** Grouped by entity type, most-likely group first. Include an "Actions" group for jump-to commands. */
  groups?: PaletteGroup[];
  /** Flat index of the highlighted row across all groups. */
  cursor?: number;
  onSelect?: (item: PaletteItem) => void;
  onClose?: () => void;
  placeholder?: string;
}

/** ⌘K global search across merchants, stores, users, orders and phone numbers, plus jump-to actions. */
export declare function CommandPalette(props: CommandPaletteProps): JSX.Element | null;
