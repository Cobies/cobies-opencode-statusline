// TUI token hydration from OpenCode API state

import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { StatuslineState, ChildSessionState, ChildTokenState } from "../../../domain/entities/statusline-state.js";
import { mergeTokens } from "../../../domain/services/token-merge.js";
import { extractChildDetails } from "./tui-detail-extractor.js";

function safeRead<Value>(read: () => Value): Value | undefined {
  try { return read(); } catch { return undefined; }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function messageIDOf(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  const id = record.id ?? record.messageID ?? record.messageId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function pushSessionCandidates(
  api: TuiPluginApi,
  sessionID: string | undefined,
  candidates: unknown[],
): void {
  if (!sessionID) return;
  const status = safeRead(() => api.state.session.status(sessionID));
  if (status) candidates.push(status);
  const messages = safeRead(() => api.state.session.messages(sessionID));
  if (!messages) return;
  candidates.push(messages);
  for (const message of messages) {
    const messageID = messageIDOf(message);
    if (!messageID) continue;
    const parts = safeRead(() => api.state.part(messageID));
    if (parts) candidates.push(parts);
  }
}

function hydrateChildTokensFromTuiState(
  api: TuiPluginApi,
  child: ChildSessionState,
): ChildTokenState | undefined {
  const candidates: unknown[] = [];
  pushSessionCandidates(api, child.id, candidates);
  if (child.messageID) {
    const parentParts = safeRead(() => api.state.part(child.messageID as string));
    if (parentParts) candidates.push(parentParts);
    const parentMessages = safeRead(() => api.state.session.messages(child.parentID));
    const parentMessage = parentMessages?.find(
      (message) => messageIDOf(message) === child.messageID,
    );
    if (parentMessage) candidates.push(parentMessage);
  }
  let tokens: ChildTokenState | undefined;
  for (const candidate of candidates) {
    const details = extractChildDetails(candidate);
    tokens = mergeTokens(tokens, details.tokens);
  }
  return tokens;
}

export function hydrateTokensFromTuiState(
  api: TuiPluginApi,
  state: StatuslineState,
): boolean {
  let changed = false;
  for (const child of Object.values(state.children)) {
    const hydrated = hydrateChildTokensFromTuiState(api, child);
    const nextTokens = mergeTokens(child.tokens, hydrated);
    if (JSON.stringify(nextTokens) !== JSON.stringify(child.tokens)) {
      child.tokens = nextTokens;
      child.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) {
    state.updatedAt = new Date().toISOString();
  }
  return changed;
}