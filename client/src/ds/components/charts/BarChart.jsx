import React from "react";

/* Operational bar chart. Rules: horizontal gridlines only, values labelled
   directly where they fit, one accent per series, no gradients, no 3D, no
   drop shadows. Charts here are for monitoring, not for persuasion. */
export function BarChart({
  data = [], height = 160, color = "var(--viz-1)", highlightColor = "var(--status-danger)",
  isHighlighted, formatValue = (v) => v, showGrid = true, gridLines = 3, label, className = ""
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => (max / gridLines) * i);
  return (
    <div className={["nch-frame", className].filter(Boolean).join(" ")}>
      <div style={{ position: "relative", height, display: "flex", alignItems: "flex-end", gap: 4, paddingInlineStart: 34 }} role="img" aria-label={label || "Bar chart"}>
        {showGrid ? (
          <div style={{ position: "absolute", inset: 0, insetInlineStart: 34, pointerEvents: "none" }}>
            {ticks.map((t, i) => (
              <div key={i} style={{ position: "absolute", insetInline: 0, bottom: (i / gridLines) * 100 + "%", height: 1, background: "var(--chart-grid)" }}>
                <span style={{ position: "absolute", insetInlineEnd: "100%", top: -7, paddingInlineEnd: 6, fontFamily: "var(--ff-mono)", fontSize: "var(--chart-label-fs)", color: "var(--text-faint)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {formatValue(Math.round(t))}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {data.map((d, i) => {
          const hot = isHighlighted ? isHighlighted(d) : false;
          return (
            <div key={d.label + i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 0, position: "relative" }}>
              <div
                title={d.label + ": " + formatValue(d.value)}
                style={{ height: Math.max(2, (d.value / max) * 100) + "%", background: hot ? highlightColor : color, borderRadius: "var(--chart-bar-radius) var(--chart-bar-radius) 0 0", transition: "height var(--dur-slow) var(--ease)" }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, paddingInlineStart: 34 }}>
        {data.map((d, i) => (
          <div key={d.label + i} style={{ flex: 1, textAlign: "center", fontFamily: "var(--ff-mono)", fontSize: "var(--chart-label-fs)", color: "var(--text-faint)", overflow: "hidden", whiteSpace: "nowrap" }}>
            {d.tick !== false ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
