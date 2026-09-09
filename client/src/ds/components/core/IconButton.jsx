import React from "react";
import { Icon } from "./Icon.jsx";

export function IconButton({ icon, label, size = "md", tone = "plain", className = "", ...rest }) {
  return (
    <button
      type="button"
      className={["nib", size === "sm" ? "nib--sm" : "", tone === "bordered" ? "nib--bordered" : "", tone === "onNav" ? "nib--onnav" : "", className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 15 : 17} />
    </button>
  );
}
