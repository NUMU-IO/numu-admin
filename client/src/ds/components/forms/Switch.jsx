import React from "react";

export function Switch({ checked = false, onChange, label, description, disabled = false, className = "", ...rest }) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : rest["aria-label"]}
      disabled={disabled}
      onClick={() => onChange && onChange(!checked)}
      className={["nsw", checked ? "nsw--on" : "", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
  if (!label) return control;
  return (
    <div className="nsw-row">
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span>{label}</span>
        {description ? <span style={{ fontSize: "var(--fs-app-xs)", color: "var(--text-muted)" }}>{description}</span> : null}
      </span>
      {control}
    </div>
  );
}
