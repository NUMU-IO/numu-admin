import React from "react";
import { Icon } from "./Icon.jsx";

export function Chip({ selected = false, variant = "solid", count, onRemove, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={["nch", selected ? "nch--on" : "", variant === "outline" && !selected ? "nch--outline" : "", className].filter(Boolean).join(" ")}
      aria-pressed={selected}
      {...rest}
    >
      {children}
      {count != null ? <span className="nch__count">{count}</span> : null}
      {onRemove ? (
        <span
          className="nch__x"
          role="button"
          tabIndex={-1}
          aria-label="Remove filter"
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
        >
          <Icon name="x" size={12} />
        </span>
      ) : null}
    </button>
  );
}
