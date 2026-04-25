// Domain — pure types, no external dependencies

export type ChildStatus = "running" | "done" | "error" | "blocked" | "waiting" | "stopped";

export interface ChildTokenState {
  input?: number;
  output?: number;
  total?: number;
  contextPercent?: number;
}

export interface ChildEventEntry {
  timestamp: string;
  type: string;
  detail?: string;
}

/**
 * UI-driven control flag.
 * These are LOCAL to the TUI viewer — they do NOT communicate with the runtime.
 * - "blocked": user manually blocked this subagent (visual only)
 * - "stopped": user manually stopped this subagent (visual only)
 * - "waiting": subagent is waiting for something (derived from status if not set explicitly)
 */
export type UIControlFlag = "blocked" | "stopped";

export interface ChildSessionState {
  id: string;
  title: string;
  parentID: string;
  messageID?: string;
  source?: "session" | "subtask" | "tool";
  status: ChildStatus;
  /** UI-only control flag applied by the user from the TUI */
  uiControl?: UIControlFlag;
  color: "yellow" | "green" | "red" | "cyan" | "magenta";
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  elapsedMs?: number;
  tokens?: ChildTokenState;
  /** Short human-readable summary of current state (inferred when not provided) */
  summary?: string;
  /** Model name when available (e.g. from subagent event payload) */
  model?: string;
  /** Detailed error message for error/stopped states */
  errorDetail?: string;
  /** Recent events for timeline display (accommodates plugin events) */
  eventLog: ChildEventEntry[];
}

export interface StatuslineState {
  children: Record<string, ChildSessionState>;
  updatedAt: string;
}

export interface StatusCounts {
  running: number;
  done: number;
  error: number;
  blocked: number;
  waiting: number;
  stopped: number;
}

export function statusColor(status: ChildStatus): ChildSessionState["color"] {
  if (status === "done") return "green";
  if (status === "error") return "red";
  if (status === "blocked") return "cyan";
  if (status === "waiting") return "magenta";
  return "yellow";
}