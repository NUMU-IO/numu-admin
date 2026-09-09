import React from "react";
import { IconButton } from "../core/IconButton.jsx";

export function Drawer({ open = true, title, subtitle, width, footer, onClose, children, className = "", ...rest }) {
  React.useEffect(() => {
    if (!open || !onClose) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={["ndrw", className].filter(Boolean).join(" ")} {...rest}>
      <div className="ndrw__scrim" onClick={onClose} />
      <aside className="ndrw__panel" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} style={width ? { width } : undefined}>
        <header className="ndrw__head">
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--fs-app-h2)", fontWeight: 600, color: "var(--text-heading)", margin: 0 }}>{title}</h2>
            {subtitle ? <span className="numu-label">{subtitle}</span> : null}
          </div>
          {onClose ? <IconButton icon="x" label="Close" size="sm" onClick={onClose} /> : null}
        </header>
        <div className="ndrw__body">{children}</div>
        {footer ? <footer className="ndrw__foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}
