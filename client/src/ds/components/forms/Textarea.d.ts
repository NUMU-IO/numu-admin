import type { JSX } from "react";
import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  /** RTL + Tajawal + a line-height step for realistic Arabic paragraphs. */
  arabic?: boolean;
}

/** Multi-line input for internal notes and case replies. */
export declare function Textarea(props: TextareaProps): JSX.Element;
