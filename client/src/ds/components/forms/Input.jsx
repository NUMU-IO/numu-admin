import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Input({ icon, affix, error = false, mono = false, numeric = false, arabic = false, className = "", style, ...rest }) {
  const input = (
    <input
      className={["nin", error ? "nin--err" : "", mono ? "nin--mono" : "", numeric ? "nin--num" : "", className].filter(Boolean).join(" ")}
      aria-invalid={error || undefined}
      dir={arabic ? "rtl" : rest.dir}
      style={arabic ? { fontFamily: "var(--ff-arabic)", ...style } : style}
      {...rest}
    />
  );
  if (!icon && !affix) return input;
  return (
    <span className={["nin-wrap", icon ? "nin-wrap--icon" : ""].filter(Boolean).join(" ")}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {input}
      {affix ? <span className="nin-wrap__affix">{affix}</span> : null}
    </span>
  );
}
