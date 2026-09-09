import React from "react";

export function PageHeader({ breadcrumbs, title, badges, meta, actions, children, className = "", ...rest }) {
  return (
    <div className={["nph", className].filter(Boolean).join(" ")} {...rest}>
      {breadcrumbs || null}
      <div className="nph__top">
        <h1 className="nph__title">
          {title}
          {badges ? <span style={{ display: "inline-flex", gap: "var(--sp-2)", alignItems: "center" }}>{badges}</span> : null}
        </h1>
        {actions ? <div className="nph__actions">{actions}</div> : null}
      </div>
      {meta ? <div className="nph__meta">{meta}</div> : null}
      {children}
    </div>
  );
}
