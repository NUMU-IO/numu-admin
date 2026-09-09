import type { JSX } from "react";
import type { ReactNode, HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: ReactNode;
  /** Mono uppercase kicker under the title. */
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** app = shadow + 10px (admin default). outlined/flat = hairline, no shadow. inset = paper well. */
  variant?: "app" | "outlined" | "flat" | "inset";
  /** Removes body padding — for a card wrapping a DataTable edge to edge. */
  flush?: boolean;
  hoverable?: boolean;
  children?: ReactNode;
}

/**
 * Panel surface with optional header, actions and footer.
 * @startingPoint section="Core" subtitle="App, outlined and inset card surfaces" viewport="700x200"
 */
export declare function Card(props: CardProps): JSX.Element;
