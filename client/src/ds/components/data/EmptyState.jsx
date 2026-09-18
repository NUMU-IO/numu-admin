import React from "react";
import { Icon } from "../core/Icon.jsx";

const KINDS = {
  empty:    { icon: "inbox",        cls: "" },
  noResults:{ icon: "search",       cls: "" },
  error:    { icon: "alertTriangle",cls: "nes--error" },
  denied:   { icon: "lock",         cls: "nes--denied" },
  offline:  { icon: "wifiOff",      cls: "nes--offline" },
  partial:  { icon: "alertCircle",  cls: "nes--denied" }
};

export function EmptyState({ kind = "empty", icon, title, body, action, secondaryAction, className = "", ...rest }) {
  const def = KINDS[kind] || KINDS.empty;
  return (
    <div className={["nes", def.cls, className].filter(Boolean).join(" ")} role={kind === "error" ? "alert" : undefined} {...rest}>
      <div className="nes__icon"><Icon name={icon || def.icon} size={20} /></div>
      {title ? <div className="nes__title">{title}</div> : null}
      {body ? <p className="nes__body">{body}</p> : null}
      {action || secondaryAction ? (
        <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-1)" }}>{action}{secondaryAction}</div>
      ) : null}
    </div>
  );
}
