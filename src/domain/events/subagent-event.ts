// Domain — SubagentEvent (the canonical internal event type)

import type { ChildTokenState, ChildStatus } from "../entities/statusline-state.js";

export interface SubagentEvent {
  type: string;
  sessionID?: string;
  childID?: string;
  title?: string;
  parentID?: string;
  messageID?: string;
  /** Maps runtime status to extended status — falls back to "waiting" or "running" if unknown */
  status?: ChildStatus;
  startedAt?: string;
  updatedAt?: string;
  endedAt?: string;
  tokens?: ChildTokenState;
  source?: "session" | "subtask" | "tool";
  /** Model name when available in the event payload */
  model?: string;
  /** Detailed error message or summary for error/stopped states */
  errorDetail?: string;
  /** Optional event entry for timeline — plugin can provide this */
  eventLogEntry?: {
    timestamp: string;
    type: string;
    detail?: string;
  };
}

/** Runtime statuses that the backend may emit */
export type RuntimeStatus = "running" | "done" | "error" | "idle";

/**
 * Map runtime status to extended status.
 * Unknown statuses are treated as "waiting" to show the user something is happening.
 */
export function mapRuntimeStatus(rs: RuntimeStatus | string): ChildStatus {
  if (rs === "completed") return "done";
  if (rs === "done" || rs === "error") return rs;
  if (rs === "idle") return "waiting";
  // "running" or any unknown → "running"
  return "running";
}
