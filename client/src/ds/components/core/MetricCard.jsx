import React from "react";
import { Icon } from "./Icon.jsx";

export function MetricCard({
  label, value, unit, delta, deltaDirection, note, icon, alert = false,
  loading = false, sparkline, flat = false, onClick, className = "", ...rest
}) {
  const dir = deltaDirection || (delta && String(delta).trim().startsWith("-") ? "down" : delta ? "up" : "flat");
  return (
    <div
      className={["nmt", flat ? "nmt--flat" : "", alert ? "nmt--alert" : "", className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
      {...rest}
    >
      <div className="nmt__label">
        {icon ? <Icon name={icon} size={13} /> : null}
        {label}
      </div>
      {loading ? (
        <div className="nsk" style={{ height: 30, width: "60%", borderRadius: 4 }} />
      ) : (
        <div className="nmt__row">
          <div className="nmt__value">
            {value}
            {unit ? <span className="nmt__unit">{unit}</span> : null}
          </div>
          {sparkline || null}
        </div>
      )}
      {delta || note ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          {delta ? (
            <span className={"nmt__delta nmt__delta--" + dir}>
              <Icon name={dir === "down" ? "trendingDown" : dir === "up" ? "trendingUp" : "minus"} size={12} />
              {delta}
            </span>
          ) : null}
          {note ? <span className="nmt__note">{note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
