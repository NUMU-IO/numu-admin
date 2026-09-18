import type { JSX } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { NumuIconName } from "./Icon";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: NumuIconName;
  /** Required — this is the control's only accessible name. */
  label: string;
  size?: "sm" | "md";
  /** onNav for icons sitting on the Navy sidebar/topbar chrome. */
  tone?: "plain" | "bordered" | "onNav";
}

/** Square icon-only control, 40px (32px sm) so it clears the tap minimum. */
export declare function IconButton(props: IconButtonProps): JSX.Element;
