import type { JSX } from "react";
export interface RiskScoreProps {
  /** 0–100. 0-29 low, 30-59 medium, 60-79 high, 80+ critical. */
  score: number;
  /** The signals behind the score. Required on review screens — a bare number is not reviewable. */
  reasons?: string[];
  /** Compact score + 4-segment track for a table cell. */
  inline?: boolean;
  showValue?: boolean;
  className?: string;
}

/**
 * Graded risk indicator: number, level word, 4-segment track and its reasons.
 * @startingPoint section="Admin" subtitle="Risk score with level, track and signals" viewport="700x160"
 */
export declare function RiskScore(props: RiskScoreProps): JSX.Element;
export declare function levelForScore(score: number): { key: string; label: string; color: string; segs: number };
