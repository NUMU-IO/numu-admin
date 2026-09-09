import React from "react";
import { Icon } from "../core/Icon.jsx";

const LEVELS = [
  { max: 29,  key: "low",      label: "Low",      color: "var(--risk-low)",      segs: 1 },
  { max: 59,  key: "medium",   label: "Medium",   color: "var(--risk-medium)",   segs: 2 },
  { max: 79,  key: "high",     label: "High",     color: "var(--risk-high)",     segs: 3 },
  { max: 100, key: "critical", label: "Critical", color: "var(--risk-critical)", segs: 4 }
];

export function levelForScore(score) {
  return LEVELS.find((l) => score <= l.max) || LEVELS[LEVELS.length - 1];
}

export function RiskScore({ score, reasons, inline = false, showValue = true, className = "", ...rest }) {
  const lvl = levelForScore(score);
  return (
    <div className={["nrk", inline ? "nrk--inline" : "", className].filter(Boolean).join(" ")} style={{ color: lvl.color }} {...rest}>
      <div className="nrk__top">
        {showValue ? <span className="nrk__val">{score}</span> : null}
        <span className="nrk__lvl">
          <Icon name={lvl.key === "low" ? "shield" : "shieldAlert"} size={11} style={{ verticalAlign: "-1px", marginInlineEnd: 4 }} />
          {lvl.label}
        </span>
      </div>
      <div className="nrk__track" role="img" aria-label={"Risk " + score + " of 100, " + lvl.label}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={"nrk__seg" + (i < lvl.segs ? " is-on" : "")} />)}
      </div>
      {reasons && reasons.length && !inline ? (
        <ul className="nrk__reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      ) : null}
    </div>
  );
}
