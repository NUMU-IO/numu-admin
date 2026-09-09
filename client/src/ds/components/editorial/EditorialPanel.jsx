import React from "react";

export function EditorialPanel({ peekLabel, kicker, title, children, className = "", ...rest }) {
  return (
    <div className={["nep", className].filter(Boolean).join(" ")} {...rest}>
      {peekLabel ? <span className="nep__peek">{peekLabel}</span> : null}
      {kicker ? <div className="nkick" style={{ marginBottom: "var(--sp-2)" }}>{kicker}</div> : null}
      {title ? <h3 style={{ fontFamily: "var(--ff-display)", fontWeight: 600, fontSize: "var(--fs-title-s)", color: "var(--ink-warm)", margin: "0 0 var(--sp-2)" }}>{title}</h3> : null}
      {children}
    </div>
  );
}
