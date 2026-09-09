import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";

export function Dialog({ open = true, tone = "neutral", icon, title, description, footer, width, onClose, children, className = "", ...rest }) {
  React.useEffect(() => {
    if (!open || !onClose) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={["ndlg", tone !== "neutral" ? "ndlg--" + tone : "", className].filter(Boolean).join(" ")} {...rest}>
      <div className="ndlg__scrim" onClick={onClose} />
      <div className="ndlg__panel" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} style={width ? { width } : undefined}>
        <header className="ndlg__head">
          {tone !== "neutral" || icon ? (
            <span className="ndlg__mark"><Icon name={icon || (tone === "danger" ? "alertTriangle" : "alertCircle")} size={18} /></span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 className="ndlg__title">{title}</h2>
            {description ? <p style={{ fontSize: "var(--fs-app-sm)", color: "var(--text-muted)" }}>{description}</p> : null}
          </div>
          {onClose ? <IconButton icon="x" label="Close" size="sm" onClick={onClose} /> : null}
        </header>
        {children ? <div className="ndlg__body">{children}</div> : null}
        {footer ? <footer className="ndlg__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
