import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";

const ICONS = { info: "info", success: "check", warning: "alertTriangle", danger: "alertTriangle", impersonation: "eye" };

export function Banner({ tone = "info", title, bar = false, icon, actions, onDismiss, children, className = "", ...rest }) {
  return (
    <div
      className={["nbn", "nbn--" + tone, bar ? "nbn--bar" : "", className].filter(Boolean).join(" ")}
      role={tone === "danger" || tone === "impersonation" ? "alert" : "status"}
      {...rest}
    >
      <span className="nbn__icon"><Icon name={icon || ICONS[tone] || "info"} size={17} /></span>
      <div className="nbn__body">
        {title ? <span className="nbn__title">{title}</span> : null}
        {children ? <span>{children}</span> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flex: "none" }}>{actions}</div> : null}
      {onDismiss ? <IconButton icon="x" label="Dismiss" size="sm" onClick={onDismiss} /> : null}
    </div>
  );
}
