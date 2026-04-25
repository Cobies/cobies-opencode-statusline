// Application — Initialize runtime state

import type { StatuslineState } from "../../domain/entities/statusline-state.js";
import type { StateRepository } from "../../ports/state-repository.js";

export interface RuntimeInitResult {
  state: StatuslineState;
  preserved: boolean;
}

export async function initializeRuntimeState(
  repo: StateRepository,
  preserve: boolean,
): Promise<RuntimeInitResult> {
  if (preserve) {
    const state = await repo.load();
    if (Object.keys(state.children).length > 0) {
      return { state, preserved: true };
    }
  }

  const state: StatuslineState = {
    children: {},
    updatedAt: new Date().toISOString(),
  };
  return { state, preserved: false };
}