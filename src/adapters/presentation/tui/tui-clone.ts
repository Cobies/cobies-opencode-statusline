// TUI helpers — clone state (no external deps)

import type { StatuslineState } from "../../../domain/entities/statusline-state.js";

export function cloneState(state: StatuslineState): StatuslineState {
  return {
    updatedAt: state.updatedAt,
    children: Object.fromEntries(
      Object.entries(state.children).map(([id, child]: [string, typeof state.children[string]]) => [
        id,
        {
          ...child,
          tokens: child.tokens ? { ...child.tokens } : undefined,
          eventLog: child.eventLog ? [...child.eventLog] : [],
        },
      ]),
    ),
  };
}