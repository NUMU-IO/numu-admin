import React from "react";

export function Checkbox({ label, indeterminate = false, disabled = false, compact = false, className = "", ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <label className={["ncb", disabled ? "ncb--disabled" : "", compact ? "ncb--box" : "", className].filter(Boolean).join(" ")}>
      <input ref={ref} type="checkbox" disabled={disabled} {...rest} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}
