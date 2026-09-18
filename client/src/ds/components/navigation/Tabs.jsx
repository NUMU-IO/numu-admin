import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Tabs({ tabs, active, onChange, className = "", ...rest }) {
  return (
    <div className={["ntabs", className].filter(Boolean).join(" ")} role="tablist" {...rest}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className={"ntabs__tab" + (t.id === active ? " is-active" : "")}
          onClick={() => onChange && onChange(t.id)}
        >
          {t.icon ? <Icon name={t.icon} size={15} /> : null}
          {t.label}
          {t.count != null ? <span className="ntabs__count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
