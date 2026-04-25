// Application — Rehydrate child tokens from repository

import type { StatuslineState, ChildSessionState, ChildTokenState } from "../../domain/entities/statusline-state.js";
import type { TokenUsageRepository } from "../../ports/token-usage-repository.js";
import { mergeTokens } from "../../domain/services/token-merge.js";

function hasTokenTotal(tokens: ChildTokenState | undefined): boolean {
  return typeof tokens?.total === "number" && Number.isFinite(tokens.total);
}

export interface RehydrationResult {
  changed: boolean;
  state: StatuslineState;
}

export async function rehydrateChildTokens(
  state: StatuslineState,
  repo: TokenUsageRepository,
): Promise<RehydrationResult> {
  let changed = false;

  for (const child of Object.values(state.children)) {
    // Only rehydrate completed sessions that lack token totals
    if (child.status !== "done") continue;
    if (hasTokenTotal(child.tokens)) continue;
    if (!child.id.startsWith("ses_")) continue;

    const tokens = await repo.findBySessionId(child.id);
    if (!tokens) continue;

    const nextTokens = mergeTokens(child.tokens, tokens);
    if (JSON.stringify(nextTokens) !== JSON.stringify(child.tokens)) {
      child.tokens = nextTokens;
      child.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    state.updatedAt = new Date().toISOString();
  }

  return { changed, state };
}