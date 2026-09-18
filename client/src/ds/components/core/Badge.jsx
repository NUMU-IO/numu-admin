import React from "react";
import { Icon } from "./Icon.jsx";

export function Badge({ tone = "neutral", icon, dot = false, square = false, children, className = "", ...rest }) {
  return (
    <span className={["nbg", "nbg--" + tone, square ? "nbg--square" : "", className].filter(Boolean).join(" ")} {...rest}>
      {dot ? <i className="nbg__dot" /> : null}
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
