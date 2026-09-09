import React from "react";

export function KeyValue({ items, layout = "grid", className = "", ...rest }) {
  return (
    <dl className={["nkv", layout === "rows" ? "nkv--rows" : "", className].filter(Boolean).join(" ")} {...rest}>
      {items.map((it, i) => (
        <React.Fragment key={it.label + i}>
          <dt>{it.label}</dt>
          <dd>{it.mono ? <span className={"numu-id"}>{it.value}</span> : it.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
