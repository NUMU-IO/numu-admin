import React from "react";

export function Skeleton({ width = "100%", height, lines = 1, variant = "text", className = "", style, ...rest }) {
  if (lines > 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="nsk" style={{ width: i === lines - 1 ? "62%" : width, height: height || 12 }} />
        ))}
      </div>
    );
  }
  return (
    <span
      className={["nsk", variant === "block" ? "nsk--block" : "", className].filter(Boolean).join(" ")}
      style={{ width, height: height || (variant === "block" ? "100%" : 12), display: "block", ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}
