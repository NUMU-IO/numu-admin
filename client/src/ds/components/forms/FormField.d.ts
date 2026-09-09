import type { JSX } from "react";
import type { ReactNode, HTMLAttributes } from "react";

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  /** Mono helper line — formats, examples, resulting URLs. Hidden while an error shows. */
  hint?: ReactNode;
  /** Present = the field is invalid. Announced via role="alert". */
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children?: ReactNode;
}

/** Label + control + hint/error wrapper. Every input ships inside one. */
export declare function FormField(props: FormFieldProps): JSX.Element;
