// TUI hydration from previous sessions

import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { StatuslineState } from "../../../domain/entities/statusline-state.js";
import { mapOpenCodeEventToSubagentEvent } from "../../opencode/opencode-event-mapper.js";
import { processSubagentEvent } from "../../../application/use-cases/process-subagent-event.js";
import { cloneState } from "./tui-clone.js";
import { saveState, renderStatusLine } from "./tui-persistence.js";
import { writeFile } from "node:fs/promises";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

async function safeReadAsync<Value>(read: () => Promise<Value>): Promise<Value | undefined> {
  try { return await read(); } catch { return undefined; }
}

function messageIDOf(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  const id = record.id ?? record.messageID ?? record.messageId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function normalizedSessionStatusValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function deriveSessionChildStatus(
  status: Record<string, unknown> | undefined,
): "running" | "done" | "error" | undefined {
  if (!status) return undefined;
  if (status.error) return "error";

  const values = [
    normalizedSessionStatusValue(status.type),
    normalizedSessionStatusValue(status.status),
    normalizedSessionStatusValue(status.state),
    normalizedSessionStatusValue(status.phase),
    normalizedSessionStatusValue(status.result),
  ].filter((value): value is string => Boolean(value));

  if (status.busy === true || status.running === true) {
    values.push("busy");
  }

  if (
    values.some((value) =>
      ["error", "failed", "failure", "cancelled", "canceled", "aborted"].includes(value),
    )
  ) {
    return "error";
  }

  if (values.some((value) => ["busy", "running", "pending", "queued", "in_progress"].includes(value))) {
    return "running";
  }

  if (values.some((value) => ["done", "completed", "complete", "success", "succeeded", "idle"].includes(value))) {
    return "done";
  }

  return undefined;
}

function timestampFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? undefined : millis.toString();
  }
  return undefined;
}

function timestampMillisFromUnknown(value: unknown): number | undefined {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? undefined : millis;
  }
  return undefined;
}

interface ChildMessageSummary {
  childID?: string | undefined;
  completedAt: string | undefined;
  evidenceAt: string | undefined;
  hasError: boolean;
  fetchFailed: boolean;
}

function summarizeAssistantMessages(messages: unknown[]): ChildMessageSummary {
  let completedAt: string | undefined;
  let evidenceAt: string | undefined;
  let hasError = false;
  const assistantMessages = messages
    .map((rawMessage) => asRecord(rawMessage))
    .map((message) => asRecord(message?.info))
    .filter(
      (info): info is Record<string, unknown> => info?.role === "assistant",
    )
    .sort((left, right) => {
      const time = (info: Record<string, unknown>) => {
        const t = asRecord(info.time);
        return timestampMillisFromUnknown(t?.completed) ??
          timestampMillisFromUnknown(t?.updated) ??
          timestampMillisFromUnknown(t?.created) ?? 0;
      };
      return time(left) - time(right);
    });

  for (const info of assistantMessages) {
    const time = asRecord(info.time);
    const candidate = timestampFromUnknown(time?.completed);
    const errorAt =
      timestampFromUnknown(time?.updated) ??
      timestampFromUnknown(time?.completed) ??
      timestampFromUnknown(time?.created);
    if (info.error) {
      hasError = true;
      evidenceAt = errorAt ?? evidenceAt;
    } else if (candidate) {
      completedAt = candidate;
      evidenceAt = candidate;
      hasError = false;
    }
  }

  return { completedAt, evidenceAt, hasError, fetchFailed: false };
}

export async function hydratePreviousSubagents(
  api: TuiPluginApi,
  currentSessionID: string,
  statePath: string,
  textPath: string,
  setState: (fn: (prev: StatuslineState) => StatuslineState) => void,
): Promise<boolean> {
  if (!currentSessionID) return false;

  try {
    const directory = api.state.path.directory;
    const sessionClient = api.client.session;
    let topLevelHydrationFailed = false;

    const [childrenResp, messagesResp, statusResp] = await Promise.all([
      safeReadAsync(() =>
        sessionClient?.children?.({ sessionID: currentSessionID, directory }) ??
          Promise.resolve({ data: [] } as { data: unknown[] }),
      ),
      safeReadAsync(() =>
        sessionClient?.messages?.({ sessionID: currentSessionID, directory }) ??
          Promise.resolve({ data: [] } as { data: unknown[] }),
      ),
      safeReadAsync(() =>
        sessionClient?.status?.({ directory }) ?? Promise.resolve({ data: {} } as { data: Record<string, unknown> }),
      ),
    ]);

    const children = Array.isArray(childrenResp?.data) ? childrenResp.data : [];
    const messages = Array.isArray(messagesResp?.data) ? messagesResp.data : [];
    const allStatuses = asRecord(statusResp?.data) ?? {};
    const childMessageResults = await Promise.all(
      children.map(async (child) => {
        const session = asRecord(child);
        const childID = typeof session?.id === "string" ? session.id : undefined;
        if (!childID) {
          return { childID: undefined as string | undefined, completedAt: undefined, evidenceAt: undefined, hasError: false, fetchFailed: false };
        }
        const childMessagesResp = await safeReadAsync(() =>
          sessionClient?.messages?.({ sessionID: childID, directory }) ??
            Promise.resolve({ data: [] } as { data: unknown[] }),
        );
        let fetchFailed = false;
        if (!childMessagesResp) fetchFailed = true;
        const childMessages = Array.isArray(childMessagesResp?.data) ? childMessagesResp.data : [];
        return { childID, ...summarizeAssistantMessages(childMessages), fetchFailed };
      }),
    );

    const childMessageSummaryByID = new Map<string, ChildMessageSummary>();
    for (const result of childMessageResults) {
      if (result.childID) {
        childMessageSummaryByID.set(result.childID, result as ChildMessageSummary);
      }
    }

    setState((current) => {
      const next = cloneState(current);
      let changed = false;

      for (const rawSession of children) {
        const session = asRecord(rawSession);
        if (!session || typeof session.id !== "string") continue;
        const fakeEvent = {
          type: "session.created",
          properties: {
            sessionID: session.id,
            info: session,
          },
        };
        const mapped = mapOpenCodeEventToSubagentEvent(fakeEvent);
        if (mapped && processSubagentEvent(next, mapped)) changed = true;

        const status = asRecord(allStatuses[session.id]);
        const sessionStatus = deriveSessionChildStatus(status);
        const childSummary = childMessageSummaryByID.get(session.id);
        const explicitCompletionEvidence =
          !!childSummary &&
          !childSummary.fetchFailed &&
          (typeof childSummary.completedAt === "string" || childSummary.hasError);
        const fallbackEndedAt = childSummary?.completedAt ?? childSummary?.evidenceAt;
        const statusEndedAt =
          fallbackEndedAt ??
          (session.time as Record<string, unknown>)?.completed ??
          (session.time as Record<string, unknown>)?.updated;

        if (sessionStatus === "done" || sessionStatus === "error") {
          const mappedStatus = mapOpenCodeEventToSubagentEvent({
            type: sessionStatus === "done" ? "session.idle" : "session.error",
            childID: session.id,
            endedAt: statusEndedAt as string | undefined,
          });
          if (mappedStatus && processSubagentEvent(next, mappedStatus)) changed = true;
          continue;
        }

        if (!sessionStatus && explicitCompletionEvidence) {
          const childStatus = childSummary?.hasError ? "error" : "done";
          const mappedStatus = mapOpenCodeEventToSubagentEvent({
            type: childStatus === "done" ? "session.idle" : "session.error",
            childID: session.id,
            endedAt: fallbackEndedAt,
          });
          if (mappedStatus && processSubagentEvent(next, mappedStatus)) changed = true;
        }
      }

      for (const rawMessage of messages) {
        const message = asRecord(rawMessage);
        const info = asRecord(message?.info);
        const parts = Array.isArray(message?.parts) ? message.parts : [];
        const parentMessageID = messageIDOf(message);
        const isAssistant = info?.role === "assistant";
        const time = asRecord(info?.time);
        const completedAt = timestampFromUnknown(time?.completed);
        const isCompleted = typeof completedAt === "string";
        const hasError = !!info?.error;

        for (const rawPart of parts) {
          const part = asRecord(rawPart);
          if (!part) continue;
          const partWithMessageID =
            typeof part.messageID === "string" && part.messageID.length > 0
              ? part
              : parentMessageID
                ? { ...part, messageID: parentMessageID }
                : part;
          if (
            part.type === "subtask" ||
            (part.type === "tool" && (part.tool === "delegate" || part.tool === "task"))
          ) {
            const fakeEvent = {
              type: "message.part.updated",
              properties: {
                sessionID: currentSessionID,
                info: time ? { time } : undefined,
                part: partWithMessageID,
              },
            };
            const mapped = mapOpenCodeEventToSubagentEvent(fakeEvent);
            if (mapped && processSubagentEvent(next, mapped)) changed = true;

            if (part.type === "subtask" && isAssistant && isCompleted) {
              const childID = `subtask:${part.id}`;
              const childStatus = hasError ? "error" : "done";
              const mappedStatus = mapOpenCodeEventToSubagentEvent({
                type: childStatus === "done" ? "session.idle" : "session.error",
                childID,
                endedAt: completedAt,
              });
              if (mappedStatus && processSubagentEvent(next, mappedStatus)) changed = true;
            }
          }
        }
      }

      if (!changed) return current;
      void (async () => {
        try {
          await saveState(statePath, next);
          await writeFile(textPath, renderStatusLine(next), "utf8");
        } catch {
          // best-effort
        }
      })();
      return next;
    });

    if (topLevelHydrationFailed) return false;
    return true;
  } catch {
    return false;
  }
}