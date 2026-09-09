import type { JSX } from "react";
import type { NumuIconName } from "../core/Icon";

export interface TabDef { id: string; label: string; icon?: NumuIconName; count?: number }

export interface TabsProps {
  tabs: TabDef[];
  active?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/** Related-data tabs on an entity detail page. */
export declare function Tabs(props: TabsProps): JSX.Element;
