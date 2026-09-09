import React from "react";

/* Operational sparkline: one series, no axes, no decoration. It answers
   "which way is this going" beside a metric — nothing more. */
export function Sparkline({ data = [], width = 88, height = 28, color = "var(--viz-2)", area = false, strokeWidth = 1.5, label }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / span) * (height - 3) - 1.5]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg width={width} height={height} viewBox={"0 0 " + width + " " + height} role="img" aria-label={label || "Trend sparkline"} style={{ display: "block", overflow: "visible" }}>
      {area ? <path d={d + " L" + width + " " + height + " L0 " + height + " Z"} fill={color} opacity="0.12" /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}
