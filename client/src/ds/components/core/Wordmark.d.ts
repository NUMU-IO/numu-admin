import type { JSX } from "react";
import type { HTMLAttributes } from "react";

export interface WordmarkProps extends HTMLAttributes<HTMLSpanElement> {
  /** latin = lowercase "numu"; arabic = "نُمُو" with diacritics. */
  script?: "latin" | "arabic";
  /** Cap height in px. Sidebar 22, marketing nav 26, hero plate 92+. */
  size?: number;
  tone?: "auto" | "navy" | "cream" | "sienna" | string;
}

/** The typographic NUMU wordmark, Reem Kufi 700. */
export declare function Wordmark(props: WordmarkProps): JSX.Element;
