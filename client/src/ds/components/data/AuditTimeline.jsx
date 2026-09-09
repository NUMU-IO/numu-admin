import React from "react";
import { Icon } from "../core/Icon.jsx";

export function AuditTimeline({ entries, className = "", ...rest }) {
  return (
    <ol className={["ntl", className].filter(Boolean).join(" ")} {...rest}>
      {entries.map((e, i) => (
        <li className="ntl__item" key={e.id || i}>
          <span className={"ntl__dot" + (e.tone ? " ntl__dot--" + e.tone : "")} />
          <div className="ntl__head">
            <span className="ntl__action">{e.action}</span>
            {e.actor ? (
              <span className="ntl__actor">
                {e.actorType === "system" ? <Icon name="zap" size={12} style={{ verticalAlign: "-1px", marginInlineEnd: 4, opacity: 0.6 }} /> : null}
                {e.actor}
              </span>
            ) : null}
            <span className="ntl__time" title={e.timestamp}>{e.timestamp}</span>
          </div>
          {e.entity || e.meta ? (
            <div className="ntl__meta">{[e.entity, e.meta].filter(Boolean).join("  ·  ")}</div>
          ) : null}
          {e.note ? <div className="ntl__note">{e.note}</div> : null}
        </li>
      ))}
    </ol>
  );
}
