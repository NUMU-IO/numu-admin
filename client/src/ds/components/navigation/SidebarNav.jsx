import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Wordmark } from "../core/Wordmark.jsx";

export function SidebarNav({ sections, active, onNavigate, env, collapsed = false, footer, className = "", ...rest }) {
  return (
    <nav className={["nsb", collapsed ? "nsb--collapsed" : "", className].filter(Boolean).join(" ")} aria-label="Admin sections" {...rest}>
      <div className="nsb__brand" style={collapsed ? { justifyContent: "center", padding: 0 } : undefined}>
        {collapsed ? (
          <span className="numu-sr">NUMU</span>
        ) : (
          <>
            <Wordmark size={21} tone="cream" className="nsb__wordmark" />
            {env ? <span className="nsb__env">{env}</span> : null}
          </>
        )}
      </div>
      <div className="nsb__scroll">
        {sections.map((s) => (
          <div key={s.label || "root"}>
            {s.label ? <div className="nsb__section">{s.label}</div> : null}
            {s.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className={"nsb__item" + (it.id === active ? " is-active" : "")}
                aria-current={it.id === active ? "page" : undefined}
                title={collapsed ? it.label : undefined}
                onClick={() => onNavigate && onNavigate(it.id)}
              >
                <Icon name={it.icon} size={17} />
                <span className="nsb__label">{it.label}</span>
                {it.count != null ? (
                  <span className={"nsb__count" + (it.alert ? " nsb__count--alert" : "")}>{it.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
      {footer ? <div className="nsb__foot">{footer}</div> : null}
    </nav>
  );
}
