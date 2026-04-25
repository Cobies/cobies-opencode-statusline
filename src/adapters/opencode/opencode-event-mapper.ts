// Adapter — OpenCode event mapper

import type { SubagentEvent } from "../../domain/events/subagent-event.js";
import { mapRuntimeStatus } from "../../domain/events/subagent-event.js";

export type EventLike = {
  type?: unknown;
  title?: unknown;
  name?: unknown;
  sessionID?: unknown;
  sessionId?: unknown;
  properties?: {
    id?: unknown;
    sessionID?: unknown;
    sessionId?: unknown;
    title?: unknown;
    name?: unknown;
    info?: {
      id?: unknown;
      title?: unknown;
      name?: unknown;
      sessionID?: unknown;
      sessionId?: unknown;
      parentID?: unknown;
      role?: unknown;
      time?: unknown;
    };
    part?: unknown;
  };
  [key: string]: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

/** Best-effort extraction of model name from plausible paths in the event payload */
function extractModel(event: EventLike): string | undefined {
  // properties.part.state.model
  const part = isRecord(event.properties?.part) ? event.properties.part : undefined;
  const state = isRecord(part?.state) ? part.state : undefined;
  if (asString(state?.model)) return asString(state?.model);

  // properties.part.state.input.model
  const input = isRecord(state?.input) ? state.input : undefined;
  if (asString(input?.model)) return asString(input?.model);

  // properties.info.model
  if (asString(event.properties?.info?.model)) return asString(event.properties?.info?.model);

  // top-level model
  if (asString(event.model)) return asString(event.model);

  // part.model
  if (asString(part?.model)) return asString(part?.model);

  return undefined;
}

/** Extract detailed error or reason string from various payload paths */
function extractErrorDetail(event: EventLike): string | undefined {
  const part = isRecord(event.properties?.part) ? event.properties.part : undefined;
  const state = isRecord(part?.state) ? part.state : undefined;
  const input = isRecord(state?.input) ? state.input : undefined;

  const candidates = [
    // state.error (direct error message)
    asString(state?.error),
    // input.error
    asString(input?.error),
    // state.reason (often used for stopped/aborted)
    asString(state?.reason),
    // input.reason
    asString(input?.reason),
    // info.error
    asString(event.properties?.info?.error),
    // properties.error
    asString(event.properties?.error),
    // event.error (top-level)
    asString(event.error),
  ];

  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 500) return c;
  }
  return undefined;
}

function toIsoTimestamp(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (value.trim().length === 0) return undefined;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return undefined;
    return new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return undefined;
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

function extractEventTimestamp(event: EventLike, keys: string[]): string | undefined {
  const part = isRecord(event.properties?.part) ? event.properties?.part : undefined;
  const state = isRecord(part?.state) ? part?.state : undefined;
  const sources = [
    isRecord(event.properties?.info?.time) ? event.properties?.info?.time : undefined,
    isRecord(part?.time) ? part?.time : undefined,
    isRecord(part?.timestamps) ? part?.timestamps : undefined,
    isRecord(state?.time) ? state?.time : undefined,
    isRecord(state?.timestamps) ? state?.timestamps : undefined,
    state,
    part,
  ];

  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const candidate = toIsoTimestamp(source[key as string]);
      if (candidate) return candidate;
    }
  }
  return undefined;
}

function extractSessionID(event: EventLike): string | undefined {
  return (
    asString(event.properties?.sessionID) ??
    asString(event.properties?.sessionId) ??
    asString(event.properties?.info?.sessionID) ??
    asString(event.properties?.info?.sessionId) ??
    asString(event.sessionID) ??
    asString(event.sessionId) ??
    asString(event.properties?.info?.id) ??
    asString(event.properties?.id)
  );
}

function normalizePercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

function extractChildTokens(event: EventLike): import("../../domain/entities/statusline-state.js").ChildTokenState | undefined {
  const tokenHints: import("../../domain/entities/statusline-state.js").ChildTokenState = {};
  const visited = new Set<object>();

  const walk = (node: unknown, depth: number): void => {
    if (!isRecord(node) || depth > 6) return;
    if (visited.has(node)) return;
    visited.add(node);

    for (const [rawKey, rawValue] of Object.entries(node)) {
      const key = rawKey.toLowerCase();
      const asNumber =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string" && rawValue.trim().length > 0
            ? Number(rawValue)
            : undefined;

      if (typeof asNumber === "number" && Number.isFinite(asNumber)) {
        if (key.includes("context") && (key.includes("percent") || key.includes("usage"))) {
          tokenHints.contextPercent = normalizePercent(asNumber);
        } else if ((key.includes("input") || key.includes("prompt")) && key.includes("token")) {
          tokenHints.input = asNumber;
        } else if ((key.includes("output") || key.includes("completion")) && key.includes("token")) {
          tokenHints.output = asNumber;
        } else if (key === "total" || (key.includes("total") && key.includes("token"))) {
          tokenHints.total = asNumber;
        } else if (key === "token" || key === "tokens") {
          tokenHints.total = asNumber;
        }
      }

      if (isRecord(rawValue)) {
        walk(rawValue, depth + 1);
      }
    }
  };

  walk(event, 0);

  if (
    tokenHints.input !== undefined ||
    tokenHints.output !== undefined ||
    tokenHints.total !== undefined ||
    tokenHints.contextPercent !== undefined
  ) {
    return tokenHints;
  }
  return undefined;
}

function inferSummary(event: EventLike): string | undefined {
  const info = event.properties?.info;
  const part = event.properties?.part;
  const state = isRecord(part?.state) ? part.state : undefined;
  const input = isRecord(state?.input) ? state.input : undefined;

  // Try to find a summary/reason from various locations
  const candidates = [
    isRecord(info) ? asString((info as Record<string, unknown>).reason) : undefined,
    isRecord(input) ? asString((input as Record<string, unknown>).reason) : undefined,
    isRecord(input) ? asString((input as Record<string, unknown>).summary) : undefined,
    isRecord(input) ? asString((input as Record<string, unknown>).description) : undefined,
  ];

  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 120) return c;
  }
  return undefined;
}

export function mapOpenCodeEventToSubagentEvent(event: unknown): SubagentEvent | null {
  const e = (event ?? {}) as EventLike;
  const type = asString(e.type);
  if (!type) return null;

  const tokens = extractChildTokens(e);
  const model = extractModel(e);
  const errorDetail = extractErrorDetail(e);
  const summary = inferSummary(e);

  // session.created / session.updated
  if (type === "session.created" || type === "session.updated") {
    const info = e.properties?.info;
    const parentID = asString(info?.parentID);
    if (!parentID) return null;

    const childID = asString(info?.id) ?? asString(e.properties?.id);
    if (!childID) return null;

    const title = asString(info?.title) ?? "subagent";
    const startedAt = extractEventTimestamp(e, ["started", "start", "created", "updated"]);
    const updatedAt = extractEventTimestamp(e, ["updated", "created", "started", "start"]) ?? startedAt;

    return {
      type,
      childID,
      parentID,
      title,
      source: "session",
      startedAt,
      updatedAt,
      tokens,
      model,
      eventLogEntry: { timestamp: updatedAt ?? new Date().toISOString(), type, detail: title },
    };
  }

  // session.idle → done
  if (type === "session.idle") {
    const childID = extractSessionID(e);
    if (!childID) return null;
    const endedAt = extractEventTimestamp(e, ["completed", "ended", "updated"]);
    const title = asString(e.properties?.info?.title) ?? asString(e.properties?.title);
    return {
      type: "session.idle",
      childID,
      sessionID: childID,
      title,
      status: "done",
      endedAt,
      updatedAt: endedAt,
      tokens,
      model,
      eventLogEntry: { timestamp: endedAt ?? new Date().toISOString(), type: "done", detail: title ?? "idle" },
    };
  }

  // session.error → error
  if (type === "session.error") {
    const childID = extractSessionID(e);
    if (!childID) return null;
    const endedAt = extractEventTimestamp(e, ["completed", "ended", "updated"]);
    const title = asString(e.properties?.info?.title) ?? asString(e.properties?.title);
    return {
      type: "session.error",
      childID,
      sessionID: childID,
      title,
      status: "error",
      endedAt,
      updatedAt: endedAt,
      tokens,
      model,
      errorDetail,
      eventLogEntry: { timestamp: endedAt ?? new Date().toISOString(), type: "error", detail: errorDetail ?? title ?? "error" },
    };
  }

  // message.part.updated → subtask or tool
  if (type === "message.part.updated") {
    const part = e.properties?.part;
    if (!isRecord(part)) return null;

    const partID = asString(part.id);
    const parentID = asString(part.sessionID) ?? extractSessionID(e);
    const messageID = asString(part.messageID);

    if (part.type === "subtask" && partID && parentID && messageID) {
      const description = asString(part.description);
      const command = asString(part.command);
      const agent = asString(part.agent);
      const title = description || command || agent || "subtask";
      const startedAt = extractEventTimestamp(e, ["started", "start", "created", "updated"]);
      const updatedAt = extractEventTimestamp(e, ["updated", "created", "started", "start"]) ?? startedAt;
      return {
        type: "message.part.updated",
        childID: `subtask:${partID}`,
        parentID,
        messageID,
        title,
        source: "subtask",
        startedAt,
        updatedAt,
        tokens,
        model,
        eventLogEntry: { timestamp: updatedAt ?? new Date().toISOString(), type, detail: title },
      };
    }

    if (part.type === "tool") {
      const tool = asString(part.tool);
      if (tool !== "delegate" && tool !== "task") return null;
      if (!partID || !parentID || !messageID) return null;

      const state = isRecord(part.state) ? part.state : undefined;
      const rawStatus = asString(state?.status);
      // Map runtime status (completed/running/error) → extended status
      const mappedStatus = rawStatus ? mapRuntimeStatus(rawStatus) : undefined;
      const resolvedStatus = mappedStatus ?? "running";

      const input = isRecord(state?.input) ? state.input : {};
      const description = asString(input.description);
      const subagentType = asString(input.subagent_type);
      const title = asString(state?.title) || description || subagentType || tool;
      const startedAt = extractEventTimestamp(e, ["started", "start", "created", "updated"]);
      const updatedAt = extractEventTimestamp(e, ["updated", "completed", "created", "started", "start"]) ?? startedAt;
      const endedAt = resolvedStatus !== "running"
        ? extractEventTimestamp(e, ["completed", "ended", "updated"])
        : undefined;

      return {
        type: "message.part.updated",
        childID: `tool:${partID}`,
        parentID,
        messageID,
        title,
        source: "tool",
        status: resolvedStatus,
        startedAt,
        updatedAt,
        endedAt,
        tokens,
        model,
        errorDetail,
        eventLogEntry: { timestamp: updatedAt ?? new Date().toISOString(), type, detail: title },
      };
    }
  }

  // message.updated → mark assistant subtasks done
  if (type === "message.updated") {
    const info = e.properties?.info;
    if (!isRecord(info)) return null;
    if (info.role !== "assistant") return null;

    const time = isRecord(info.time) ? info.time : undefined;
    if (!time || typeof time.completed !== "number") return null;

    const sessionID = asString(info.sessionID) ?? extractSessionID(e);
    const messageID = asString(info.id);
    if (!sessionID || !messageID) return null;

    return {
      type: "message.updated",
      sessionID,
      messageID,
      tokens,
    };
  }

  return null;
}