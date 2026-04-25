// Port — Token usage repository

import type { ChildTokenState } from "../domain/entities/statusline-state.js";

export interface TokenUsageRepository {
  findBySessionId(sessionId: string): Promise<ChildTokenState | undefined>;
}