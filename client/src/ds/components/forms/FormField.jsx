import React from "react";
import { Icon } from "../core/Icon.jsx";

export function FormField({ label, hint, error, required = false, htmlFor, children, className = "", ...rest }) {
  return (
    <div className={["nfld", className].filter(Boolean).join(" ")} {...rest}>
      {label ? (
        <label className="nfld__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="nfld__req" aria-hidden="true">*</span> : null}
          {required ? <span className="numu-sr">(required)</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="nfld__err" role="alert">
          <Icon name="alertCircle" size={12} />
          {error}
        </span>
      ) : hint ? (
        <span className="nfld__hint">{hint}</span>
      ) : null}
    </div>
  );
}
