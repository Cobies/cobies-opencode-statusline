// Application — Persist status snapshot

import type { StatuslineState } from "../../domain/entities/statusline-state.js";
import type { StateRepository } from "../../ports/state-repository.js";
import type { StatusOutput } from "../../ports/status-output.js";
import { refreshDerivedFields } from "../../domain/services/refresh-derived.js";
import { renderStatusLine } from "./build-statusline-summary.js";

export async function persistStatusSnapshot(
  state: StatuslineState,
  repo: StateRepository,
  output: StatusOutput,
): Promise<void> {
  refreshDerivedFields(state);
  await repo.save(state);
  const line = renderStatusLine(state);
  await output.write(line);
}