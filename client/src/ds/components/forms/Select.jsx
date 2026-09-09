import React from "react";

export function Select({ options = [], error = false, placeholder, children, className = "", ...rest }) {
  return (
    <select
      className={["nsel", error ? "nsel--err" : "", className].filter(Boolean).join(" ")}
      aria-invalid={error || undefined}
      {...rest}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {children}
      {options.map((o) =>
        typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}
