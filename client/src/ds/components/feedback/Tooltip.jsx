import React from "react";

export function Tooltip({ label, mono = false, children, className = "" }) {
  const [on, setOn] = React.useState(false);
  return (
    <span
      className={["ntt-wrap", className].filter(Boolean).join(" ")}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
    >
      {children}
      {on ? <span className={mono ? "ntt ntt--mono" : "ntt"} role="tooltip">{label}</span> : null}
    </span>
  );
}
