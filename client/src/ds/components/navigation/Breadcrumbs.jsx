import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Breadcrumbs({ items, onNavigate, className = "", ...rest }) {
  return (
    <nav className={["nbc", className].filter(Boolean).join(" ")} aria-label="Breadcrumb" {...rest}>
      {items.map((it, i) => (
        <React.Fragment key={it.label + i}>
          {i > 0 ? <span className="nbc__sep" aria-hidden="true"><Icon name="chevronRight" size={12} /></span> : null}
          {i === items.length - 1 ? (
            <span className="nbc__cur" aria-current="page">{it.label}</span>
          ) : (
            <button type="button" onClick={() => onNavigate && onNavigate(it.id)}>{it.label}</button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
