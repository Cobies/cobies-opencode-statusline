// Domain — derived field refresh (pure computation, no side effects)

import type { ChildSessionState, StatuslineState } from "../entities/statusline-state.js";
import { safeTimestamp, sanitizeTokens } from "../value-objects/timestamps.js";
import { statusColor } from "../entities/statusline-state.js";
import { resolveElapsedMs } from "./elapsed-time.js";

export function refreshDerivedFields(
  state: StatuslineState,
  now = new Date(),
): void {
  const nowISO = now.toISOString();
  const nowMs = now.getTime();

  for (const [id, child] of Object.entries(state.children)) {
    const startedAt = safeTimestamp(child.startedAt, nowISO);
    const updatedAt = safeTimestamp(child.updatedAt, nowISO);
    const endedAt = child.endedAt ? safeTimestamp(child.endedAt, updatedAt) : undefined;
    const status =
      child.status === "done" || child.status === "error" || child.status === "running"
        ? child.status
        : "running";

    state.children[id] = {
      ...child,
      startedAt,
      updatedAt,
      endedAt,
      status,
      color: statusColor(status),
      tokens: sanitizeTokens(child.tokens),
      elapsedMs: resolveElapsedMs(
        {
          ...child,
          startedAt,
          updatedAt,
          endedAt,
          status,
          color: statusColor(status),
        },
        nowMs,
      ),
    };
  }

  state.updatedAt = safeTimestamp(state.updatedAt, nowISO);
}