import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";

const ICONS = { success: "check", danger: "alertTriangle", info: "info" };

export function Toast({ tone = "info", title, description, action, onDismiss, className = "", ...rest }) {
  return (
    <div className={["ntst", "ntst--" + tone, className].filter(Boolean).join(" ")} role="status" aria-live="polite" {...rest}>
      <span className="ntst__icon"><Icon name={ICONS[tone] || "info"} size={16} /></span>
      <div className="ntst__body">
        <div className="ntst__title">{title}</div>
        {description ? <div className="ntst__desc">{description}</div> : null}
      </div>
      {action || null}
      {onDismiss ? <IconButton icon="x" label="Dismiss" size="sm" onClick={onDismiss} /> : null}
    </div>
  );
}

export function ToastStack({ children }) {
  return <div className="ntst-stack">{children}</div>;
}
