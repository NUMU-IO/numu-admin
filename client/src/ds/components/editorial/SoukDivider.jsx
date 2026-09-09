import React from "react";
// Imported rather than written as a relative URL string: an inline
// `background-image: url("../../assets/…")` resolves against the document,
// not the module, so it 404s in any bundled app.
import soukSienna from "../../assets/souk-tile.svg";
import soukNavy from "../../assets/souk-tile-navy.svg";

/* The Souk tile motif. Border, divider and framing device ONLY — never a
   full-page background. Two assets ship: sienna (editorial) and navy (product). */
export function SoukDivider({ tone = "sienna", height = 44, opacity, flip = false, className = "", style, ...rest }) {
  return (
    <div
      className={["nsouk", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      style={{
        height,
        opacity: opacity != null ? opacity : undefined,
        backgroundImage: "url(" + (tone === "navy" ? soukNavy : soukSienna) + ")",
        transform: flip ? "scaleY(-1)" : undefined,
        ...style
      }}
      {...rest}
    />
  );
}
