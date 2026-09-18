import React from "react";
import { Icon } from "./Icon.jsx";

/* Action hierarchy, strictly one per view:
   primary   the single expected action (Navy)
   accent    marketing CTA (Terracotta on editorial, Navy in admin)
   outline   secondary, equal-weight alternative
   subtle    toolbar / table actions
   ghost     tertiary, cancel, dismiss
   danger    destructive, always behind a ConfirmDialog
   danger-outline  destructive but reversible (refund, suspend) */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  pill = false,
  block = false,
  loading = false,
  disabled = false,
  requiresPermission,
  hasPermission = true,
  as = "button",
  children,
  className = "",
  ...rest
}) {
  const El = as;
  const blocked = requiresPermission != null && !hasPermission;
  const cls = [
    "nb",
    "nb--" + variant,
    size === "sm" ? "nb--sm" : size === "lg" ? "nb--lg" : "",
    pill ? "nb--pill" : "",
    block ? "nb--block" : "",
    loading ? "nb--loading" : "",
    className
  ].filter(Boolean).join(" ");
  return (
    <El
      className={cls}
      disabled={El === "button" ? disabled || loading || blocked : undefined}
      aria-disabled={blocked || disabled || loading ? true : undefined}
      aria-busy={loading || undefined}
      title={blocked ? "Requires " + requiresPermission : rest.title}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 15 : 16} /> : null}
      {children ? <span>{children}</span> : null}
      {blocked ? <Icon name="lock" size={13} /> : null}
      {iconEnd ? <Icon name={iconEnd} size={size === "sm" ? 15 : 16} /> : null}
    </El>
  );
}
