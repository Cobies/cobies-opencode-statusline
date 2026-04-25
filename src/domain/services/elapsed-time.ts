// Domain — elapsed time calculation

import type { ChildSessionState } from "../entities/statusline-state.js";

export function resolveElapsedMs(child: ChildSessionState, nowMs: number): number {
  const startedMs = Date.parse(child.startedAt);
  if (Number.isNaN(startedMs)) return 0;

  const endSource = child.endedAt ?? child.updatedAt;
  const endMs = child.endedAt ? Date.parse(endSource) : nowMs;
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, endMs - startedMs);
}