import React from "react";
import { Icon } from "../core/Icon.jsx";

export function CommandPalette({ open = true, query = "", onQueryChange, groups = [], cursor = 0, onSelect, onClose, placeholder = "Search merchants, stores, users, orders, phone numbers…" }) {
  React.useEffect(() => {
    if (!open || !onClose) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  let idx = -1;
  return (
    <div className="ncp">
      <div className="ncp__scrim" onClick={onClose} />
      <div className="ncp__panel" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="ncp__input">
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => onQueryChange && onQueryChange(e.target.value)} placeholder={placeholder} autoFocus aria-label="Global search" />
          <span className="ntp__kbd">esc</span>
        </div>
        <div className="ncp__list" role="listbox">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="ncp__group">{g.label}</div>
              {g.items.map((it) => {
                idx += 1;
                const me = idx;
                return (
                  <div
                    key={it.id}
                    role="option"
                    aria-selected={me === cursor}
                    className={"ncp__row" + (me === cursor ? " is-cursor" : "")}
                    onClick={() => onSelect && onSelect(it)}
                  >
                    <Icon name={it.icon} size={16} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                    {it.meta ? <span className="numu-id" style={{ fontSize: "var(--fs-app-meta)", color: "var(--text-faint)" }}>{it.meta}</span> : null}
                    <span className="ncp__kind">{it.kind}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="ncp__foot">
          <span>↑↓ navigate</span><span>↵ open</span><span>⌘↵ open in new tab</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
