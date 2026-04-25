// Domain — child session transitions

import type { ChildSessionState, ChildTokenState, StatuslineState, ChildStatus, UIControlFlag } from "../entities/statusline-state.js";
import { safeTimestamp } from "../value-objects/timestamps.js";
import { statusColor } from "../entities/statusline-state.js";
import { resolveElapsedMs } from "./elapsed-time.js";
import { mergeTokens } from "./token-merge.js";

export function upsertRunningChild(
  state: StatuslineState,
  input: Pick<ChildSessionState, "id" | "title" | "parentID"> &
    Partial<
      Pick<
        ChildSessionState,
        "messageID" | "source" | "startedAt" | "updatedAt"
      >
    >,
): boolean {
  const now = new Date().toISOString();
  const observedUpdatedAt = safeTimestamp(input.updatedAt, now);
  const observedStartedAt = safeTimestamp(input.startedAt, observedUpdatedAt);
  const existing = state.children[input.id];
  const shouldKeepCompletedTiming =
    existing?.status === "done" || existing?.status === "error";
  const uiControl = existing?.uiControl;
  const next: ChildSessionState = {
    id: input.id,
    title: input.title,
    parentID: input.parentID,
    messageID: input.messageID ?? existing?.messageID,
    source: input.source ?? existing?.source ?? "session",
    status: shouldKeepCompletedTiming ? existing.status : "running",
    uiControl: shouldKeepCompletedTiming ? (existing.uiControl ?? uiControl) : uiControl,
    color: statusColor(shouldKeepCompletedTiming ? existing.status : "running"),
    startedAt: existing?.startedAt ?? observedStartedAt,
    updatedAt: observedUpdatedAt,
    endedAt: shouldKeepCompletedTiming ? existing.endedAt : undefined,
    elapsedMs: existing?.elapsedMs,
    tokens: existing?.tokens,
    summary: existing?.summary,
    model: existing?.model,
    errorDetail: existing?.errorDetail,
    eventLog: existing?.eventLog ?? [],
  };

  state.children[input.id] = next;
  state.updatedAt = observedUpdatedAt;
  return true;
}

export function markChildStatus(
  state: StatuslineState,
  childID: string,
  status: Exclude<ChildStatus, "running">,
  endedAt?: string,
): boolean {
  const existing = state.children[childID];
  if (!existing) {
    return false;
  }

  const now = new Date().toISOString();
  const observedEndedAt = safeTimestamp(endedAt, now);
  const nextChild: ChildSessionState = {
    ...existing,
    status,
    uiControl: existing.uiControl,
    color: statusColor(status),
    updatedAt: observedEndedAt,
    endedAt: observedEndedAt,
  };
  state.children[childID] = {
    ...nextChild,
    elapsedMs: resolveElapsedMs(nextChild, Date.now()),
  };
  state.updatedAt = observedEndedAt;
  return true;
}

export function upsertChildDetails(
  state: StatuslineState,
  childID: string,
  input: {
    title?: string;
    tokens?: ChildTokenState;
    updatedAt?: string;
    summary?: string;
    model?: string;
    errorDetail?: string;
  },
): boolean {
  const existing = state.children[childID];
  if (!existing) return false;

  const nextTitle =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title
      : existing.title;
  const mergedTokens = mergeTokens(existing.tokens, input.tokens);

  const detailsChanged =
    nextTitle !== existing.title ||
    JSON.stringify(mergedTokens) !== JSON.stringify(existing.tokens) ||
    input.model !== existing.model ||
    input.errorDetail !== existing.errorDetail;

  const shouldTouch = existing.status === "running";
  if (!detailsChanged && !shouldTouch) return false;

  const now = new Date().toISOString();
  const observedUpdatedAt = safeTimestamp(input.updatedAt, now);
  state.children[childID] = {
    ...existing,
    title: nextTitle,
    tokens: mergedTokens,
    updatedAt: observedUpdatedAt,
    summary: input.summary ?? existing.summary,
    model: input.model ?? existing.model,
    errorDetail: input.errorDetail ?? existing.errorDetail,
  };
  state.updatedAt = observedUpdatedAt;
  return true;
}

/**
 * Apply a UI-only control flag (block/stop) to a child.
 * This does NOT communicate with the runtime — it's purely visual state in the TUI.
 */
export function applyUIControl(
  state: StatuslineState,
  childID: string,
  flag: UIControlFlag,
): boolean {
  const existing = state.children[childID];
  if (!existing) return false;
  if (existing.status === "done" || existing.status === "error") return false;
  state.children[childID] = {
    ...existing,
    uiControl: flag,
    status: flag === "stopped" ? "stopped" : existing.status,
    color: statusColor(flag === "stopped" ? "stopped" : existing.status),
  };
  state.updatedAt = new Date().toISOString();
  return true;
}

/**
 * Remove UI control flag and restore running status if the child was blocked/stopped.
 */
export function removeUIControl(
  state: StatuslineState,
  childID: string,
): boolean {
  const existing = state.children[childID];
  if (!existing) return false;
  if (!existing.uiControl) return false;
  const restored = existing.status === "stopped" ? "running" : existing.status;
  state.children[childID] = {
    ...existing,
    uiControl: undefined,
    status: restored,
    color: statusColor(restored),
  };
  state.updatedAt = new Date().toISOString();
  return true;
}

/**
 * Append an event to the child's event log.
 * Keeps the log bounded to the last `maxEntries` entries.
 */
export function appendChildEventLog(
  state: StatuslineState,
  childID: string,
  entry: { timestamp: string; type: string; detail?: string },
  maxEntries = 50,
): boolean {
  const existing = state.children[childID];
  if (!existing) return false;
  const log = [...(existing.eventLog ?? []), entry];
  if (log.length > maxEntries) {
    log.splice(0, log.length - maxEntries);
  }
  state.children[childID] = { ...existing, eventLog: log };
  return true;
}