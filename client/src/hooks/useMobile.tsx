import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * True below `breakpoint`.
 *
 * The shell needs two different thresholds — 1180px, where the navigation
 * rail collapses to icons, and 900px, where it becomes an overlay drawer —
 * so the breakpoint is a parameter rather than a module constant. The
 * default keeps the original 768px behaviour for existing callers.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < breakpoint,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < breakpoint);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}
