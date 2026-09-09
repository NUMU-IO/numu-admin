import React from "react";

/* The NUMU wordmark is typographic, not a drawn mark: Reem Kufi 700,
   all-lowercase Latin "numu" at -0.04em, or Arabic "نُمُو" with diacritics.
   The source brand material referenced assets/numu-wordmark.png, which was
   NOT supplied — see readme.md "Missing assets". Until the file arrives this
   component IS the mark; do not substitute a drawn logo. */
export function Wordmark({ script = "latin", size = 32, tone = "auto", className = "", style, ...rest }) {
  const color = tone === "auto" ? "currentColor" : tone === "navy" ? "var(--navy-700)" : tone === "cream" ? "var(--cream)" : tone === "sienna" ? "var(--sienna)" : tone;
  const isAr = script === "arabic";
  return (
    <span
      className={["numu-wordmark", className].filter(Boolean).join(" ")}
      dir={isAr ? "rtl" : "ltr"}
      style={{
        fontFamily: "var(--ff-display)",
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: isAr ? "0" : "-0.04em",
        color,
        ...style
      }}
      {...rest}
    >
      {isAr ? "نُمُو" : "numu"}
    </span>
  );
}
