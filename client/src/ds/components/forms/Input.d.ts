import type { JSX } from "react";
import type { InputHTMLAttributes } from "react";
import type { NumuIconName } from "../core/Icon";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Leading glyph — search, phone, domain fields. */
  icon?: NumuIconName;
  /** Trailing mono affix, e.g. "EGP" or ".numueg.app". */
  affix?: string;
  error?: boolean;
  /** Mono + tabular — IDs, subdomains, keys, references. */
  mono?: boolean;
  /** Tabular and end-aligned — amounts, quantities. */
  numeric?: boolean;
  /** Forces RTL and Tajawal for an Arabic-content field regardless of UI locale. */
  arabic?: boolean;
}

/**
 * 40px text input with icon, affix and validation states.
 * @startingPoint section="Forms" subtitle="Inputs, selects, checkbox and switch states" viewport="700x260"
 */
export declare function Input(props: InputProps): JSX.Element;
