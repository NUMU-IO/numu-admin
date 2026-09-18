import React from "react";
import { Badge } from "./Badge.jsx";

/* The platform's lifecycle vocabulary in one place. Adding a status means
   adding it here, so the same word never renders two colours in two screens. */
export const NUMU_STATUS = {
  active:        { tone: "success", icon: "check",         label: "Active" },
  paid:          { tone: "success", icon: "check",         label: "Paid" },
  shipped:       { tone: "success", icon: "truck",         label: "Shipped" },
  delivered:     { tone: "success", icon: "check",         label: "Delivered" },
  healthy:       { tone: "success", icon: "activity",      label: "Healthy" },
  resolved:      { tone: "success", icon: "check",         label: "Resolved" },
  verified:      { tone: "success", icon: "shield",        label: "Verified" },
  trial:         { tone: "info",    icon: "clock",         label: "Trial" },
  draft:         { tone: "info",    icon: "fileText",      label: "Draft" },
  open:          { tone: "info",    icon: "inbox",         label: "Open" },
  new:           { tone: "solid",   icon: null,            label: "New" },
  pending:       { tone: "warning", icon: "clock",         label: "Pending" },
  in_review:     { tone: "warning", icon: "eye",           label: "In review" },
  degraded:      { tone: "warning", icon: "alertTriangle", label: "Degraded" },
  past_due:      { tone: "warning", icon: "alertTriangle", label: "Past due" },
  low_stock:     { tone: "warning", icon: "package",       label: "Low stock" },
  retrying:      { tone: "warning", icon: "refresh",       label: "Retrying" },
  failed:        { tone: "danger",  icon: "x",             label: "Failed" },
  refunded:      { tone: "danger",  icon: "arrowLeft",     label: "Refunded" },
  suspended:     { tone: "danger",  icon: "slash",         label: "Suspended" },
  chargeback:    { tone: "danger",  icon: "alertCircle",   label: "Chargeback" },
  down:          { tone: "danger",  icon: "alertTriangle", label: "Down" },
  cancelled:     { tone: "neutral", icon: "x",             label: "Cancelled" },
  archived:      { tone: "neutral", icon: null,            label: "Archived" },
  churned:       { tone: "neutral", icon: null,            label: "Churned" },
  closed:        { tone: "neutral", icon: null,            label: "Closed" }
};

export function StatusBadge({ status, label, icon, ...rest }) {
  const def = NUMU_STATUS[status] || { tone: "neutral", icon: null, label: status };
  const glyph = icon === null ? null : icon || def.icon;
  return <Badge tone={def.tone} icon={glyph || undefined} {...rest}>{label || def.label}</Badge>;
}
