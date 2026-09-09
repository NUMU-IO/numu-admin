import React from "react";

export function Card({ title, subtitle, actions, footer, variant = "app", flush = false, hoverable = false, children, className = "", ...rest }) {
  const cls = [
    "ncd",
    variant === "outlined" ? "ncd--outlined" : "",
    variant === "flat" ? "ncd--flat" : "",
    variant === "inset" ? "ncd--inset" : "",
    hoverable ? "ncd--hover" : "",
    className
  ].filter(Boolean).join(" ");
  return (
    <section className={cls} {...rest}>
      {title || actions ? (
        <header className="ncd__head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {title ? <h3 className="ncd__title">{title}</h3> : null}
            {subtitle ? <span className="ncd__sub">{subtitle}</span> : null}
          </div>
          {actions ? <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? "ncd__body ncd__body--flush" : "ncd__body"}>{children}</div>
      {footer ? <footer className="ncd__foot">{footer}</footer> : null}
    </section>
  );
}
