import type { JSX } from "react";
import type { ReactNode } from "react";

export interface AuditEntry {
  id?: string;
  /** What happened, in past tense: "Suspended store", "Refunded order". */
  action: string;
  /** Who did it — a staff name, or a service name for automated actions. */
  actor?: string;
  /** "system" prints the automation glyph so machine actions are never mistaken for human ones. */
  actorType?: "staff" | "merchant" | "system";
  /** ISO-ish timestamp string, printed mono and LTR-isolated. */
  timestamp: string;
  /** Affected entity, e.g. "store_4812 · Rahab Boutique". */
  entity?: string;
  /** Extra technical context — IP, before→after values, request id. */
  meta?: string;
  /** Free-text internal note attached to the event. */
  note?: ReactNode;
  tone?: "success" | "warning" | "danger" | "info";
}

export interface AuditTimelineProps {
  entries: AuditEntry[];
  className?: string;
}

/**
 * Actor / action / time / affected-entity audit history and lifecycle timeline.
 * @startingPoint section="Admin" subtitle="Audit history with actor, action, time and entity" viewport="700x300"
 */
export declare function AuditTimeline(props: AuditTimelineProps): JSX.Element;
