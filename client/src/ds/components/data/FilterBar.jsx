import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../core/Button.jsx";
import { Input } from "../forms/Input.jsx";

export function FilterBar({
  savedViews, activeView, onViewChange, search, onSearchChange, searchPlaceholder = "Filter…",
  children, actions, selectedCount = 0, bulkActions, onClearSelection, className = "", ...rest
}) {
  if (selectedCount > 0) {
    return (
      <div className="nfb__bulk" role="toolbar" aria-label="Bulk actions">
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{selectedCount} selected</strong>
        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>{bulkActions}</div>
        <div className="nfb__spacer" />
        <Button variant="ghost" size="sm" icon="x" onClick={onClearSelection}>Clear</Button>
      </div>
    );
  }
  return (
    <div className={["nfb", className].filter(Boolean).join(" ")} role="toolbar" aria-label="Filters" {...rest}>
      {savedViews && savedViews.length ? (
        <div className="nfb__saved">
          {savedViews.map((v) => (
            <button key={v.id} className={v.id === activeView ? "is-on" : ""} onClick={() => onViewChange && onViewChange(v.id)} aria-pressed={v.id === activeView}>
              {v.label}
            </button>
          ))}
        </div>
      ) : null}
      {onSearchChange ? (
        <div style={{ width: 240 }}>
          <Input icon="search" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} style={{ height: 32, fontSize: "var(--fs-app-sm)" }} />
        </div>
      ) : null}
      {children ? <div className="nfb__group">{children}</div> : null}
      <div className="nfb__spacer" />
      {actions ? <div className="nfb__group">{actions}</div> : (
        <div className="nfb__group">
          <Button variant="subtle" size="sm" icon="sliders">Columns</Button>
          <Button variant="subtle" size="sm" icon="download">Export CSV</Button>
        </div>
      )}
    </div>
  );
}
