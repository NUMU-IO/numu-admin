import type { JSX } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<string | { value: string; label: string }>;
  error?: boolean;
  placeholder?: string;
  children?: ReactNode;
}

/** Native select with the NUMU chevron; the chevron flips under RTL. */
export declare function Select(props: SelectProps): JSX.Element;
