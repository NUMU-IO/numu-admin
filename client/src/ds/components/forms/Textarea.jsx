import React from "react";

export function Textarea({ error = false, arabic = false, className = "", style, ...rest }) {
  return (
    <textarea
      className={["nta", error ? "nta--err" : "", className].filter(Boolean).join(" ")}
      aria-invalid={error || undefined}
      dir={arabic ? "rtl" : rest.dir}
      style={arabic ? { fontFamily: "var(--ff-arabic)", lineHeight: 1.7, ...style } : style}
      {...rest}
    />
  );
}
