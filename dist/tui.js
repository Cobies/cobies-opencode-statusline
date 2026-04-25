// src/adapters/presentation/tui/tui-plugin.tsx
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { For, Show, createEffect, createSignal as createSignal2, createMemo as createMemo2 } from "solid-js";

// src/domain/events/subagent-event.ts
function mapRuntimeStatus(rs) {
  if (rs === "completed") return "done";
  if (rs === "done" || rs === "error") return rs;
  if (rs === "idle") return "waiting";
  return "running";
}

// src/adapters/opencode/opencode-event-mapper.ts
function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function isRecord(value) {
  return !!value && typeof value === "object";
}
function extractModel(event) {
  const part = isRecord(event.properties?.part) ? event.properties.part : void 0;
  const state = isRecord(part?.state) ? part.state : void 0;
  if (asString(state?.model)) return asString(state?.model);
  const input = isRecord(state?.input) ? state.input : void 0;
  if (asString(input?.model)) return asString(input?.model);
  if (asString(event.properties?.info?.model)) return asString(event.properties?.info?.model);
  if (asString(event.model)) return asString(event.model);
  if (asString(part?.model)) return asString(part?.model);
  return void 0;
}
function extractErrorDetail(event) {
  const part = isRecord(event.properties?.part) ? event.properties.part : void 0;
  const state = isRecord(part?.state) ? part.state : void 0;
  const input = isRecord(state?.input) ? state.input : void 0;
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
    asString(event.error)
  ];
  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 500) return c;
  }
  return void 0;
}
function toIsoTimestamp(value) {
  if (typeof value === "string") {
    if (value.trim().length === 0) return void 0;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return void 0;
    return new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return void 0;
    const millis = value < 1e10 ? value * 1e3 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? void 0 : parsed.toISOString();
  }
  return void 0;
}
function extractEventTimestamp(event, keys) {
  const part = isRecord(event.properties?.part) ? event.properties?.part : void 0;
  const state = isRecord(part?.state) ? part?.state : void 0;
  const sources = [
    isRecord(event.properties?.info?.time) ? event.properties?.info?.time : void 0,
    isRecord(part?.time) ? part?.time : void 0,
    isRecord(part?.timestamps) ? part?.timestamps : void 0,
    isRecord(state?.time) ? state?.time : void 0,
    isRecord(state?.timestamps) ? state?.timestamps : void 0,
    state,
    part
  ];
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const candidate = toIsoTimestamp(source[key]);
      if (candidate) return candidate;
    }
  }
  return void 0;
}
function extractSessionID(event) {
  return asString(event.properties?.sessionID) ?? asString(event.properties?.sessionId) ?? asString(event.properties?.info?.sessionID) ?? asString(event.properties?.info?.sessionId) ?? asString(event.sessionID) ?? asString(event.sessionId) ?? asString(event.properties?.info?.id) ?? asString(event.properties?.id);
}
function normalizePercent(value) {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}
function extractChildTokens(event) {
  const tokenHints = {};
  const visited = /* @__PURE__ */ new Set();
  const walk = (node, depth) => {
    if (!isRecord(node) || depth > 6) return;
    if (visited.has(node)) return;
    visited.add(node);
    for (const [rawKey, rawValue] of Object.entries(node)) {
      const key = rawKey.toLowerCase();
      const asNumber = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" && rawValue.trim().length > 0 ? Number(rawValue) : void 0;
      if (typeof asNumber === "number" && Number.isFinite(asNumber)) {
        if (key.includes("context") && (key.includes("percent") || key.includes("usage"))) {
          tokenHints.contextPercent = normalizePercent(asNumber);
        } else if ((key.includes("input") || key.includes("prompt")) && key.includes("token")) {
          tokenHints.input = asNumber;
        } else if ((key.includes("output") || key.includes("completion")) && key.includes("token")) {
          tokenHints.output = asNumber;
        } else if (key === "total" || key.includes("total") && key.includes("token")) {
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
  if (tokenHints.input !== void 0 || tokenHints.output !== void 0 || tokenHints.total !== void 0 || tokenHints.contextPercent !== void 0) {
    return tokenHints;
  }
  return void 0;
}
function inferSummary(event) {
  const info = event.properties?.info;
  const part = event.properties?.part;
  const state = isRecord(part?.state) ? part.state : void 0;
  const input = isRecord(state?.input) ? state.input : void 0;
  const candidates = [
    isRecord(info) ? asString(info.reason) : void 0,
    isRecord(input) ? asString(input.reason) : void 0,
    isRecord(input) ? asString(input.summary) : void 0,
    isRecord(input) ? asString(input.description) : void 0
  ];
  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 120) return c;
  }
  return void 0;
}
function mapOpenCodeEventToSubagentEvent(event) {
  const e = event ?? {};
  const type = asString(e.type);
  if (!type) return null;
  const tokens = extractChildTokens(e);
  const model = extractModel(e);
  const errorDetail = extractErrorDetail(e);
  const summary = inferSummary(e);
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
      eventLogEntry: { timestamp: updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type, detail: title }
    };
  }
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
      eventLogEntry: { timestamp: endedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type: "done", detail: title ?? "idle" }
    };
  }
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
      eventLogEntry: { timestamp: endedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type: "error", detail: errorDetail ?? title ?? "error" }
    };
  }
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
        eventLogEntry: { timestamp: updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type, detail: title }
      };
    }
    if (part.type === "tool") {
      const tool = asString(part.tool);
      if (tool !== "delegate" && tool !== "task") return null;
      if (!partID || !parentID || !messageID) return null;
      const state = isRecord(part.state) ? part.state : void 0;
      const rawStatus = asString(state?.status);
      const mappedStatus = rawStatus ? mapRuntimeStatus(rawStatus) : void 0;
      const resolvedStatus = mappedStatus ?? "running";
      const input = isRecord(state?.input) ? state.input : {};
      const description = asString(input.description);
      const subagentType = asString(input.subagent_type);
      const title = asString(state?.title) || description || subagentType || tool;
      const startedAt = extractEventTimestamp(e, ["started", "start", "created", "updated"]);
      const updatedAt = extractEventTimestamp(e, ["updated", "completed", "created", "started", "start"]) ?? startedAt;
      const endedAt = resolvedStatus !== "running" ? extractEventTimestamp(e, ["completed", "ended", "updated"]) : void 0;
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
        eventLogEntry: { timestamp: updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type, detail: title }
      };
    }
  }
  if (type === "message.updated") {
    const info = e.properties?.info;
    if (!isRecord(info)) return null;
    if (info.role !== "assistant") return null;
    const time = isRecord(info.time) ? info.time : void 0;
    if (!time || typeof time.completed !== "number") return null;
    const sessionID = asString(info.sessionID) ?? extractSessionID(e);
    const messageID = asString(info.id);
    if (!sessionID || !messageID) return null;
    return {
      type: "message.updated",
      sessionID,
      messageID,
      tokens
    };
  }
  return null;
}

// src/domain/value-objects/timestamps.ts
function safeTimestamp(input, fallback) {
  if (typeof input !== "string") return fallback;
  return Number.isNaN(Date.parse(input)) ? fallback : input;
}
function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
function sanitizeTokens(input) {
  if (!input || typeof input !== "object") return void 0;
  const raw = input;
  const tokens = {
    input: toFiniteNumber(raw.input),
    output: toFiniteNumber(raw.output),
    total: toFiniteNumber(raw.total),
    contextPercent: toFiniteNumber(raw.contextPercent)
  };
  if (tokens.input === void 0 && tokens.output === void 0 && tokens.total === void 0 && tokens.contextPercent === void 0) {
    return void 0;
  }
  return tokens;
}

// src/domain/entities/statusline-state.ts
function statusColor(status) {
  if (status === "done") return "green";
  if (status === "error") return "red";
  if (status === "blocked") return "cyan";
  if (status === "waiting") return "magenta";
  return "yellow";
}

// src/domain/services/elapsed-time.ts
function resolveElapsedMs(child, nowMs) {
  const startedMs = Date.parse(child.startedAt);
  if (Number.isNaN(startedMs)) return 0;
  const endSource = child.endedAt ?? child.updatedAt;
  const endMs = child.endedAt ? Date.parse(endSource) : nowMs;
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, endMs - startedMs);
}

// src/domain/services/token-merge.ts
function mergeTokens(existing, incoming) {
  if (!existing && !incoming) return void 0;
  return {
    input: incoming?.input ?? existing?.input,
    output: incoming?.output ?? existing?.output,
    total: incoming?.total ?? existing?.total,
    contextPercent: incoming?.contextPercent ?? existing?.contextPercent
  };
}

// src/domain/services/child-transitions.ts
function upsertRunningChild(state, input) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const observedUpdatedAt = safeTimestamp(input.updatedAt, now);
  const observedStartedAt = safeTimestamp(input.startedAt, observedUpdatedAt);
  const existing = state.children[input.id];
  const shouldKeepCompletedTiming = existing?.status === "done" || existing?.status === "error";
  const uiControl = existing?.uiControl;
  const next = {
    id: input.id,
    title: input.title,
    parentID: input.parentID,
    messageID: input.messageID ?? existing?.messageID,
    source: input.source ?? existing?.source ?? "session",
    status: shouldKeepCompletedTiming ? existing.status : "running",
    uiControl: shouldKeepCompletedTiming ? existing.uiControl ?? uiControl : uiControl,
    color: statusColor(shouldKeepCompletedTiming ? existing.status : "running"),
    startedAt: existing?.startedAt ?? observedStartedAt,
    updatedAt: observedUpdatedAt,
    endedAt: shouldKeepCompletedTiming ? existing.endedAt : void 0,
    elapsedMs: existing?.elapsedMs,
    tokens: existing?.tokens,
    summary: existing?.summary,
    model: existing?.model,
    errorDetail: existing?.errorDetail,
    eventLog: existing?.eventLog ?? []
  };
  state.children[input.id] = next;
  state.updatedAt = observedUpdatedAt;
  return true;
}
function markChildStatus(state, childID, status, endedAt) {
  const existing = state.children[childID];
  if (!existing) {
    return false;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const observedEndedAt = safeTimestamp(endedAt, now);
  const nextChild = {
    ...existing,
    status,
    uiControl: existing.uiControl,
    color: statusColor(status),
    updatedAt: observedEndedAt,
    endedAt: observedEndedAt
  };
  state.children[childID] = {
    ...nextChild,
    elapsedMs: resolveElapsedMs(nextChild, Date.now())
  };
  state.updatedAt = observedEndedAt;
  return true;
}
function upsertChildDetails(state, childID, input) {
  const existing = state.children[childID];
  if (!existing) return false;
  const nextTitle = typeof input.title === "string" && input.title.trim().length > 0 ? input.title : existing.title;
  const mergedTokens = mergeTokens(existing.tokens, input.tokens);
  const detailsChanged = nextTitle !== existing.title || JSON.stringify(mergedTokens) !== JSON.stringify(existing.tokens) || input.model !== existing.model || input.errorDetail !== existing.errorDetail;
  const shouldTouch = existing.status === "running";
  if (!detailsChanged && !shouldTouch) return false;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const observedUpdatedAt = safeTimestamp(input.updatedAt, now);
  state.children[childID] = {
    ...existing,
    title: nextTitle,
    tokens: mergedTokens,
    updatedAt: observedUpdatedAt,
    summary: input.summary ?? existing.summary,
    model: input.model ?? existing.model,
    errorDetail: input.errorDetail ?? existing.errorDetail
  };
  state.updatedAt = observedUpdatedAt;
  return true;
}
function appendChildEventLog(state, childID, entry, maxEntries = 50) {
  const existing = state.children[childID];
  if (!existing) return false;
  const log = [...existing.eventLog ?? [], entry];
  if (log.length > maxEntries) {
    log.splice(0, log.length - maxEntries);
  }
  state.children[childID] = { ...existing, eventLog: log };
  return true;
}

// src/application/use-cases/process-subagent-event.ts
function makeEventEntry(event) {
  return {
    timestamp: event.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    type: event.type,
    detail: event.errorDetail ?? event.title
  };
}
function processSubagentEvent(state, event) {
  const { type } = event;
  if (!type) return false;
  if (type === "session.created" || type === "session.updated") {
    if (!event.childID || !event.parentID) return false;
    const details = {
      title: event.title,
      tokens: event.tokens,
      updatedAt: event.updatedAt,
      model: event.model
    };
    let changed = upsertRunningChild(state, {
      id: event.childID,
      title: event.title ?? "subagent",
      parentID: event.parentID,
      messageID: event.messageID,
      source: event.source ?? "session",
      startedAt: event.startedAt,
      updatedAt: event.updatedAt
    });
    changed = upsertChildDetails(state, event.childID, details) || changed;
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, makeEventEntry(event));
    }
    return changed;
  }
  if (type === "session.idle") {
    if (!event.childID) return false;
    const endedAt = event.endedAt ?? event.updatedAt;
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt, model: event.model, errorDetail: event.errorDetail };
    let changed = markChildStatus(state, event.childID, "done", endedAt);
    changed = upsertChildDetails(state, event.childID, details) || changed;
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, { timestamp: endedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type: "done", detail: event.title ?? "idle" });
    }
    return changed;
  }
  if (type === "session.error") {
    if (!event.childID) return false;
    const endedAt = event.endedAt ?? event.updatedAt;
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt, model: event.model, errorDetail: event.errorDetail };
    let changed = markChildStatus(state, event.childID, "error", endedAt);
    changed = upsertChildDetails(state, event.childID, details) || changed;
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, { timestamp: endedAt ?? (/* @__PURE__ */ new Date()).toISOString(), type: "error", detail: event.title ?? "error" });
    }
    return changed;
  }
  if (type === "message.part.updated") {
    if (!event.childID || !event.parentID) return false;
    const mappedStatus = event.status ? mapRuntimeStatus(event.status) : void 0;
    let changed = upsertRunningChild(state, {
      id: event.childID,
      title: event.title ?? "subagent",
      parentID: event.parentID,
      messageID: event.messageID,
      source: event.source ?? "subtask",
      startedAt: event.startedAt,
      updatedAt: event.updatedAt
    });
    if (mappedStatus === "done" || mappedStatus === "error") {
      const ended = event.endedAt ?? event.updatedAt;
      changed = markChildStatus(state, event.childID, mappedStatus, ended) || changed;
    } else if (mappedStatus === "waiting") {
      if (state.children[event.childID]) {
        state.children[event.childID].status = "waiting";
        state.children[event.childID].color = "magenta";
      }
      changed = true;
    }
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt, model: event.model, errorDetail: event.errorDetail };
    changed = upsertChildDetails(state, event.childID, details) || changed;
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, makeEventEntry(event));
    }
    return changed;
  }
  if (type === "message.updated") {
    if (!event.sessionID || !event.messageID) return false;
    let changed = false;
    for (const child of Object.values(state.children)) {
      if (child.source === "subtask" && child.status === "running" && child.parentID === event.sessionID && child.messageID === event.messageID) {
        changed = markChildStatus(state, child.id, "done") || changed;
        appendChildEventLog(state, child.id, { timestamp: (/* @__PURE__ */ new Date()).toISOString(), type: "done", detail: "assistant completed" });
      }
    }
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt };
    if (state.children[event.sessionID]) {
      changed = upsertChildDetails(state, event.sessionID, details) || changed;
    }
    return changed;
  }
  return false;
}

// src/adapters/presentation/tui/tui-view-model.ts
import { createSignal, createMemo } from "solid-js";

// src/domain/services/state-counts.ts
function getCounts(state) {
  const counts = { running: 0, done: 0, error: 0, blocked: 0, waiting: 0, stopped: 0 };
  for (const child of Object.values(state.children)) {
    if (child.status === "running") counts.running += 1;
    else if (child.status === "done") counts.done += 1;
    else if (child.status === "error") counts.error += 1;
    else if (child.status === "blocked") counts.blocked += 1;
    else if (child.status === "waiting") counts.waiting += 1;
    else if (child.status === "stopped") counts.stopped += 1;
  }
  return counts;
}

// src/adapters/presentation/tui/tui-view-model.ts
var FALLBACK_SIDEBAR_WIDTH = 46;
var MIN_ROW_WIDTH = 24;
var MIN_LABEL_WIDTH = 8;
function normalizeTitle(value) {
  return value.toLowerCase().replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}
function isGenericToolWrapper(child) {
  if (child.source !== "tool") return false;
  const title = normalizeTitle(child.title);
  return title === "delegate" || title === "task";
}
function relatedTitles(a, b) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}
function collapseToolWrappers(children) {
  const realChildren = children.filter((child) => child.source !== "tool");
  return children.filter((child) => {
    if (child.source !== "tool") return true;
    if (isGenericToolWrapper(child) && realChildren.some((real) => real.parentID === child.parentID)) {
      return false;
    }
    return !realChildren.some(
      (real) => real.parentID === child.parentID && relatedTitles(real.title, child.title)
    );
  });
}
function statusRank(status) {
  switch (status) {
    case "running":
      return 0;
    case "blocked":
      return 1;
    case "waiting":
      return 2;
    case "error":
      return 3;
    case "stopped":
      return 4;
    case "done":
      return 5;
    default:
      return 6;
  }
}
function byPriority(a, b) {
  const diff = statusRank(a.status) - statusRank(b.status);
  if (diff !== 0) return diff;
  return b.updatedAt.localeCompare(a.updatedAt);
}
function formatDuration(elapsedMs2) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs2 / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function resolveTokenTotal(child) {
  const total = child.tokens?.total;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const input = child.tokens?.input;
  const output = child.tokens?.output;
  if (typeof input === "number" || typeof output === "number") {
    return Math.max(0, (input ?? 0) + (output ?? 0));
  }
  return void 0;
}
function formatCompactTokenCount(total) {
  const value = Math.max(0, total);
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M tok`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k tok`;
  return `${Math.round(value)} tok`;
}
function formatCompactPercent(percent) {
  return `${Math.max(0, Math.round(percent))}%`;
}
function compactModelName(model, maxLen = 15) {
  if (!model || model.length === 0) return void 0;
  const last = model.split("/").pop();
  const stripped = last.replace(/^(text-|chat-)?(gpt|claude|deepseek|llama|mistral|qwen|gemini)[-_]/i, "");
  const chosen = stripped.length < last.length && stripped.length <= maxLen ? stripped : last;
  if (chosen.length <= maxLen) return chosen;
  return chosen.slice(0, maxLen - 1) + "\u2026";
}
function contextVariants(child) {
  const total = resolveTokenTotal(child);
  const percent = child.tokens?.contextPercent;
  const hasTotal = typeof total === "number" && Number.isFinite(total);
  const hasPercent = typeof percent === "number" && Number.isFinite(percent);
  if (!hasTotal && !hasPercent) return [""];
  const tokenPart = hasTotal ? formatCompactTokenCount(total) : "";
  const percentPart = hasPercent ? formatCompactPercent(percent) : "";
  const parts = [];
  if (tokenPart && percentPart) parts.push(`${tokenPart} ${percentPart}`, tokenPart, percentPart, "");
  else if (tokenPart) parts.push(tokenPart, "");
  else if (percentPart) parts.push(percentPart, "");
  return parts;
}
function splitParentheticalTitle(title) {
  const match = title.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  if (!match) return { label: title };
  const label = match[1]?.trim();
  const parenthetical = match[2]?.trim();
  if (!label || !parenthetical) return { label: title };
  return { label, parenthetical };
}
function rowWidthBudget(sidebarWidth) {
  const width = sidebarWidth ?? FALLBACK_SIDEBAR_WIDTH;
  return Math.max(MIN_ROW_WIDTH, Math.min(width, 120));
}
function elapsedMs(child, nowMs) {
  if (child.status !== "running") return child.elapsedMs ?? 0;
  const started = Date.parse(child.startedAt);
  if (Number.isNaN(started)) return child.elapsedMs ?? 0;
  return Math.max(0, nowMs - started);
}
function formatChildRowLine(child, nowMs, sidebarWidth, isSelected = false, isFocused = false) {
  const ms = elapsedMs(child, nowMs);
  const elapsed = formatDuration(ms);
  const width = rowWidthBudget(sidebarWidth);
  const title = splitParentheticalTitle(child.title);
  for (const meta of contextVariants(child)) {
    const detailChars = 2 + elapsed.length + (meta ? 3 + meta.length : 0);
    const labelBudget = Math.min(width - 2, width - Math.max(0, detailChars - width));
    if (labelBudget >= MIN_LABEL_WIDTH || meta.length === 0) {
      return {
        label: title.label.length > labelBudget ? `${title.label.slice(0, Math.max(0, labelBudget - 1))}\u2026` : title.label,
        parenthetical: title.parenthetical,
        elapsed,
        meta,
        status: child.status,
        uiControl: child.uiControl,
        color: child.color,
        isSelected,
        isFocused,
        model: child.model,
        modelBadge: compactModelName(child.model)
      };
    }
  }
  return {
    label: title.label.length > MIN_LABEL_WIDTH ? `${title.label.slice(0, Math.max(0, MIN_LABEL_WIDTH - 1))}\u2026` : title.label,
    parenthetical: title.parenthetical,
    elapsed,
    meta: "",
    status: child.status,
    uiControl: child.uiControl,
    color: child.color,
    isSelected,
    isFocused,
    model: child.model,
    modelBadge: compactModelName(child.model)
  };
}
function buildHierarchy(children, sessionID) {
  const result = [];
  const childMap = /* @__PURE__ */ new Map();
  for (const child of children) {
    const parent = child.parentID;
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent).push(child);
  }
  function traverse(parentID, depth) {
    const kids = childMap.get(parentID) ?? [];
    const sorted = [...kids].sort(byPriority);
    for (const child of sorted) {
      const childId = childMap.has(child.id);
      result.push({ child, depth, isOrphan: false, hasChildren: childId });
      if (childId) traverse(child.id, depth + 1);
    }
  }
  const direct = childMap.get(sessionID) ?? [];
  const directSorted = [...direct].sort(byPriority);
  for (const child of directSorted) {
    const childId = childMap.has(child.id);
    result.push({ child, depth: 0, isOrphan: false, hasChildren: childId });
    if (childId) traverse(child.id, 1);
  }
  const knownIds = new Set(result.map((n) => n.child.id));
  for (const child of children) {
    if (!knownIds.has(child.id) && childMap.has(child.id)) {
      result.push({ child, depth: 1, isOrphan: true, hasChildren: childMap.has(child.id) });
    }
  }
  return result;
}
function formatDetail(child, nowMs) {
  const ms = elapsedMs(child, nowMs);
  const lastEvent = child.eventLog.length > 0 ? child.eventLog[child.eventLog.length - 1] : void 0;
  return {
    id: child.id,
    title: child.title,
    parentID: child.parentID,
    messageID: child.messageID,
    source: child.source ?? "session",
    status: child.status,
    uiControl: child.uiControl,
    color: child.color,
    startedAt: child.startedAt,
    updatedAt: child.updatedAt,
    endedAt: child.endedAt,
    elapsed: formatDuration(ms),
    elapsedMs: ms,
    tokens: child.tokens,
    summary: child.summary,
    model: child.model,
    errorDetail: child.errorDetail,
    eventLog: child.eventLog,
    lastEvent
  };
}
function createTuiViewModel(state, nowMs, initialExpanded = true, initialStatusFilters) {
  const [expanded, setExpanded] = createSignal(initialExpanded);
  const [selectedIds, setSelectedIds] = createSignal(/* @__PURE__ */ new Set());
  const [focusedId, setFocusedId] = createSignal(void 0);
  const [statusFilters, setStatusFilters] = createSignal(
    initialStatusFilters ?? /* @__PURE__ */ new Set(["running", "done", "error", "blocked", "waiting", "stopped"])
  );
  const counts = createMemo(() => getCounts(state()));
  const childrenForSession = (sessionID) => {
    return collapseToolWrappers(
      Object.values(state().children).filter((child) => child.parentID === sessionID)
    ).sort(byPriority);
  };
  const otherChildren = () => {
    return collapseToolWrappers(
      Object.values(state().children)
    ).sort(byPriority);
  };
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectOnly = (id) => {
    setSelectedIds(/* @__PURE__ */ new Set([id]));
    setFocusedId(id);
  };
  const clearSelection = () => {
    setSelectedIds(/* @__PURE__ */ new Set());
    setFocusedId(void 0);
  };
  const childHierarchy = () => {
    const sessionID = "";
    return buildHierarchy(otherChildren(), sessionID);
  };
  const focusedDetail = () => {
    const fid = focusedId();
    if (!fid) return void 0;
    const child = state().children[fid];
    if (!child) return void 0;
    return formatDetail(child, nowMs());
  };
  const blockSelected = () => {
    setSelectedIds((ids) => {
      for (const id of ids) {
        const child = state().children[id];
        if (!child) continue;
        if (child.status === "done" || child.status === "error") continue;
        state().children[id] = {
          ...child,
          uiControl: "blocked",
          status: "blocked",
          color: "cyan"
        };
      }
      return ids;
    });
  };
  const stopSelected = () => {
    setSelectedIds((ids) => {
      for (const id of ids) {
        const child = state().children[id];
        if (!child) continue;
        if (child.status === "done" || child.status === "error") continue;
        state().children[id] = {
          ...child,
          uiControl: "stopped",
          status: "stopped",
          color: "red"
        };
      }
      return ids;
    });
  };
  const clearControls = () => {
    for (const id of selectedIds()) {
      const child = state().children[id];
      if (!child || !child.uiControl) continue;
      const restored = child.status === "stopped" ? "running" : child.status;
      state().children[id] = {
        ...child,
        uiControl: void 0,
        status: restored,
        color: restored === "running" ? "yellow" : restored === "error" ? "red" : restored === "done" ? "green" : child.color
      };
    }
  };
  let onStatusFiltersChange;
  const toggleStatusFilter = (status) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      onStatusFiltersChange?.(next);
      return next;
    });
  };
  const setStatusFiltersChangeCallback = (fn) => {
    onStatusFiltersChange = fn;
  };
  const filteredChildHierarchy = () => {
    const filters = statusFilters();
    return childHierarchy().filter((node) => filters.has(node.child.status));
  };
  return {
    state,
    nowMs,
    counts,
    childrenForSession,
    otherChildren,
    expanded,
    setExpanded,
    selectedIds,
    toggleSelect,
    clearSelection,
    selectOnly,
    focusedId,
    setFocusedId,
    childHierarchy,
    filteredChildHierarchy,
    focusedDetail,
    statusFilters,
    setStatusFilters,
    toggleStatusFilter,
    setStatusFiltersChangeCallback,
    blockSelected,
    stopSelected,
    clearControls
  };
}
function formatTimestamp(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function formatTokenDetail(tokens) {
  if (!tokens) return "\u2014";
  const parts = [];
  if (tokens.input !== void 0) parts.push(`in:${tokens.input}`);
  if (tokens.output !== void 0) parts.push(`out:${tokens.output}`);
  if (tokens.total !== void 0) parts.push(`tot:${tokens.total}`);
  if (tokens.contextPercent !== void 0) parts.push(`${tokens.contextPercent}%ctx`);
  return parts.join(" ") || "\u2014";
}

// src/adapters/presentation/tui/tui-clone.ts
function cloneState(state) {
  return {
    updatedAt: state.updatedAt,
    children: Object.fromEntries(
      Object.entries(state.children).map(([id, child]) => [
        id,
        {
          ...child,
          tokens: child.tokens ? { ...child.tokens } : void 0,
          eventLog: child.eventLog ? [...child.eventLog] : []
        }
      ])
    )
  };
}

// src/adapters/presentation/tui/tui-detail-extractor.ts
function asRecord(value) {
  return value && typeof value === "object" ? value : void 0;
}
function asString2(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function normalizePercent2(value) {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}
function extractChildDetails(event) {
  const details = {};
  const walk = (node, depth) => {
    if (!asRecord(node) || depth > 6) return;
    const rec = node;
    if (!details.title) {
      const props = rec.properties;
      const info = props?.info;
      const candidates = [
        info?.title,
        props?.title,
        info?.name,
        props?.name,
        rec.title,
        rec.name
      ];
      for (const candidate of candidates) {
        const title = asString2(candidate);
        if (title) {
          details.title = title;
          break;
        }
      }
    }
    const tokenHints = {};
    const visited = /* @__PURE__ */ new Set();
    const walkEntries = (obj, d) => {
      if (!asRecord(obj) || d > 6) return;
      if (visited.has(obj)) return;
      visited.add(obj);
      for (const [rawKey, rawValue] of Object.entries(obj)) {
        const key = rawKey.toLowerCase();
        const asNumber = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" && rawValue.trim().length > 0 ? Number(rawValue) : void 0;
        if (typeof asNumber === "number" && Number.isFinite(asNumber)) {
          if (key.includes("context") && (key.includes("percent") || key.includes("usage"))) {
            tokenHints.contextPercent = normalizePercent2(asNumber);
          } else if ((key.includes("input") || key.includes("prompt")) && key.includes("token")) {
            tokenHints.input = asNumber;
          } else if ((key.includes("output") || key.includes("completion")) && key.includes("token")) {
            tokenHints.output = asNumber;
          } else if (key.includes("total") && key.includes("token")) {
            tokenHints.total = asNumber;
          } else if (key === "tokens" || key === "token") {
            tokenHints.total = asNumber;
          }
        }
        if (asRecord(rawValue)) {
          walkEntries(rawValue, d + 1);
        }
      }
    };
    walkEntries(rec, depth);
    if (tokenHints.input !== void 0 || tokenHints.output !== void 0 || tokenHints.total !== void 0 || tokenHints.contextPercent !== void 0) {
      details.tokens = tokenHints;
    }
  };
  walk(event, 0);
  return details;
}

// src/adapters/presentation/tui/tui-token-hydration.ts
function safeRead(read) {
  try {
    return read();
  } catch {
    return void 0;
  }
}
function asRecord2(value) {
  return value && typeof value === "object" ? value : void 0;
}
function messageIDOf(message) {
  const record = asRecord2(message);
  if (!record) return void 0;
  const id = record.id ?? record.messageID ?? record.messageId;
  return typeof id === "string" && id.length > 0 ? id : void 0;
}
function pushSessionCandidates(api, sessionID, candidates) {
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
function hydrateChildTokensFromTuiState(api, child) {
  const candidates = [];
  pushSessionCandidates(api, child.id, candidates);
  if (child.messageID) {
    const parentParts = safeRead(() => api.state.part(child.messageID));
    if (parentParts) candidates.push(parentParts);
    const parentMessages = safeRead(() => api.state.session.messages(child.parentID));
    const parentMessage = parentMessages?.find(
      (message) => messageIDOf(message) === child.messageID
    );
    if (parentMessage) candidates.push(parentMessage);
  }
  let tokens;
  for (const candidate of candidates) {
    const details = extractChildDetails(candidate);
    tokens = mergeTokens(tokens, details.tokens);
  }
  return tokens;
}
function hydrateTokensFromTuiState(api, state) {
  let changed = false;
  for (const child of Object.values(state.children)) {
    const hydrated = hydrateChildTokensFromTuiState(api, child);
    const nextTokens = mergeTokens(child.tokens, hydrated);
    if (JSON.stringify(nextTokens) !== JSON.stringify(child.tokens)) {
      child.tokens = nextTokens;
      child.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      changed = true;
    }
  }
  if (changed) {
    state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  return changed;
}

// src/application/use-cases/build-statusline-summary.ts
function formatDuration2(elapsedMs2) {
  const totalSeconds = Math.max(0, Math.floor((elapsedMs2 ?? 0) / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function resolveTokenTotal2(child) {
  const total = child.tokens?.total;
  if (typeof total === "number" && Number.isFinite(total)) {
    return total;
  }
  const inTokens = child.tokens?.input;
  const outTokens = child.tokens?.output;
  if (typeof inTokens === "number" || typeof outTokens === "number") {
    return (inTokens ?? 0) + (outTokens ?? 0);
  }
  return void 0;
}
function formatPercentUsed(percent) {
  const rounded = Math.round(percent * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return `${Math.round(rounded)}% used`;
  }
  return `${rounded.toFixed(1)}% used`;
}
function formatTokenCount(total) {
  const label = total === 1 ? "token" : "tokens";
  return `${Math.max(0, Math.round(total)).toLocaleString("en-US")} ${label}`;
}
function formatContext(child) {
  const total = resolveTokenTotal2(child);
  const percent = child.tokens?.contextPercent;
  const hasPercent = typeof percent === "number" && Number.isFinite(percent);
  const hasTotal = typeof total === "number" && Number.isFinite(total);
  if (hasTotal && hasPercent) {
    return `ctx ${formatTokenCount(total)} \xB7 ${formatPercentUsed(percent)}`;
  }
  if (hasTotal) return `ctx ${formatTokenCount(total)}`;
  if (hasPercent) return `ctx ${formatPercentUsed(percent)}`;
  return "";
}
function childColor(child) {
  if (child.color === "green") return "\x1B[32m";
  if (child.color === "red") return "\x1B[31m";
  return "\x1B[33m";
}
function colorsEnabled() {
  if (process.env.NO_COLOR) return false;
  const fromEnv = process.env.OPENCODE_SUBAGENT_STATUSLINE_COLOR;
  if (fromEnv === "0") return false;
  return true;
}
function paint(text, color, enabled) {
  if (!enabled) return text;
  return `${color}${text}\x1B[0m`;
}
function byPriority2(a, b) {
  const rank = (status) => {
    if (status === "running") return 0;
    if (status === "error") return 1;
    return 2;
  };
  const diff = rank(a.status) - rank(b.status);
  if (diff !== 0) return diff;
  return b.updatedAt.localeCompare(a.updatedAt);
}
function buildStatuslineSummary(state) {
  const allChildren = Object.values(state.children);
  const hasMatchingSubtask = (child) => child.source === "tool" && allChildren.some(
    (candidate) => candidate.source === "subtask" && candidate.parentID === child.parentID && candidate.messageID === child.messageID
  );
  const children = allChildren.filter((child) => !hasMatchingSubtask(child)).sort(byPriority2);
  const running = children.filter((c) => c.status === "running").length;
  const done = children.filter((c) => c.status === "done").length;
  const error = children.filter((c) => c.status === "error").length;
  const colorOn = colorsEnabled();
  const aggregate = `\u21B3 ${running} running \xB7 ${done} done \xB7 ${error} error`;
  if (children.length === 0) {
    return { running, done, error, total: 0, details: aggregate };
  }
  const childTexts = children.map((child) => {
    const context = formatContext(child);
    const label = [child.title, formatDuration2(child.elapsedMs), context].filter((part) => part.length > 0).join(" ");
    return paint(label, childColor(child), colorOn);
  });
  const details = childTexts.join(paint(" \xB7 ", "\x1B[90m", colorOn));
  return {
    running,
    done,
    error,
    total: children.length,
    details: `${aggregate} \xB7 ${details}`
  };
}
function renderStatusLine(state) {
  return buildStatuslineSummary(state).details;
}

// src/domain/services/refresh-derived.ts
function refreshDerivedFields(state, now = /* @__PURE__ */ new Date()) {
  const nowISO = now.toISOString();
  const nowMs = now.getTime();
  for (const [id, child] of Object.entries(state.children)) {
    const startedAt = safeTimestamp(child.startedAt, nowISO);
    const updatedAt = safeTimestamp(child.updatedAt, nowISO);
    const endedAt = child.endedAt ? safeTimestamp(child.endedAt, updatedAt) : void 0;
    const status = child.status === "done" || child.status === "error" || child.status === "running" ? child.status : "running";
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
          color: statusColor(status)
        },
        nowMs
      )
    };
  }
  state.updatedAt = safeTimestamp(state.updatedAt, nowISO);
}

// src/adapters/presentation/tui/tui-persistence.ts
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
async function saveState(statePath, state) {
  refreshDerivedFields(state);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}
function cloneState2(state) {
  return {
    updatedAt: state.updatedAt,
    children: Object.fromEntries(
      Object.entries(state.children).map(([id, child]) => [
        id,
        {
          ...child,
          tokens: child.tokens ? { ...child.tokens } : void 0
        }
      ])
    )
  };
}
function persistStateSnapshot(statePath, textPath, state) {
  const snapshot = cloneState2(state);
  void (async () => {
    try {
      await saveState(statePath, snapshot);
      await writeFile(textPath, renderStatusLine(snapshot), "utf8");
    } catch {
    }
  })();
}

// src/adapters/presentation/tui/tui-hydration.ts
import { writeFile as writeFile2 } from "fs/promises";
function asRecord3(value) {
  return value && typeof value === "object" ? value : void 0;
}
async function safeReadAsync(read) {
  try {
    return await read();
  } catch {
    return void 0;
  }
}
function messageIDOf2(message) {
  const record = asRecord3(message);
  if (!record) return void 0;
  const id = record.id ?? record.messageID ?? record.messageId;
  return typeof id === "string" && id.length > 0 ? id : void 0;
}
function normalizedSessionStatusValue(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : void 0;
}
function deriveSessionChildStatus(status) {
  if (!status) return void 0;
  if (status.error) return "error";
  const values = [
    normalizedSessionStatusValue(status.type),
    normalizedSessionStatusValue(status.status),
    normalizedSessionStatusValue(status.state),
    normalizedSessionStatusValue(status.phase),
    normalizedSessionStatusValue(status.result)
  ].filter((value) => Boolean(value));
  if (status.busy === true || status.running === true) {
    values.push("busy");
  }
  if (values.some(
    (value) => ["error", "failed", "failure", "cancelled", "canceled", "aborted"].includes(value)
  )) {
    return "error";
  }
  if (values.some((value) => ["busy", "running", "pending", "queued", "in_progress"].includes(value))) {
    return "running";
  }
  if (values.some((value) => ["done", "completed", "complete", "success", "succeeded", "idle"].includes(value))) {
    return "done";
  }
  return void 0;
}
function timestampFromUnknown(value) {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? void 0 : new Date(parsed).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const millis = value < 1e10 ? value * 1e3 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? void 0 : millis.toString();
  }
  return void 0;
}
function timestampMillisFromUnknown(value) {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? void 0 : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const millis = value < 1e10 ? value * 1e3 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? void 0 : millis;
  }
  return void 0;
}
function summarizeAssistantMessages(messages) {
  let completedAt;
  let evidenceAt;
  let hasError = false;
  const assistantMessages = messages.map((rawMessage) => asRecord3(rawMessage)).map((message) => asRecord3(message?.info)).filter(
    (info) => info?.role === "assistant"
  ).sort((left, right) => {
    const time = (info) => {
      const t = asRecord3(info.time);
      return timestampMillisFromUnknown(t?.completed) ?? timestampMillisFromUnknown(t?.updated) ?? timestampMillisFromUnknown(t?.created) ?? 0;
    };
    return time(left) - time(right);
  });
  for (const info of assistantMessages) {
    const time = asRecord3(info.time);
    const candidate = timestampFromUnknown(time?.completed);
    const errorAt = timestampFromUnknown(time?.updated) ?? timestampFromUnknown(time?.completed) ?? timestampFromUnknown(time?.created);
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
async function hydratePreviousSubagents(api, currentSessionID, statePath, textPath, setState) {
  if (!currentSessionID) return false;
  try {
    const directory = api.state.path.directory;
    const sessionClient = api.client.session;
    let topLevelHydrationFailed = false;
    const [childrenResp, messagesResp, statusResp] = await Promise.all([
      safeReadAsync(
        () => sessionClient?.children?.({ sessionID: currentSessionID, directory }) ?? Promise.resolve({ data: [] })
      ),
      safeReadAsync(
        () => sessionClient?.messages?.({ sessionID: currentSessionID, directory }) ?? Promise.resolve({ data: [] })
      ),
      safeReadAsync(
        () => sessionClient?.status?.({ directory }) ?? Promise.resolve({ data: {} })
      )
    ]);
    const children = Array.isArray(childrenResp?.data) ? childrenResp.data : [];
    const messages = Array.isArray(messagesResp?.data) ? messagesResp.data : [];
    const allStatuses = asRecord3(statusResp?.data) ?? {};
    const childMessageResults = await Promise.all(
      children.map(async (child) => {
        const session = asRecord3(child);
        const childID = typeof session?.id === "string" ? session.id : void 0;
        if (!childID) {
          return { childID: void 0, completedAt: void 0, evidenceAt: void 0, hasError: false, fetchFailed: false };
        }
        const childMessagesResp = await safeReadAsync(
          () => sessionClient?.messages?.({ sessionID: childID, directory }) ?? Promise.resolve({ data: [] })
        );
        let fetchFailed = false;
        if (!childMessagesResp) fetchFailed = true;
        const childMessages = Array.isArray(childMessagesResp?.data) ? childMessagesResp.data : [];
        return { childID, ...summarizeAssistantMessages(childMessages), fetchFailed };
      })
    );
    const childMessageSummaryByID = /* @__PURE__ */ new Map();
    for (const result of childMessageResults) {
      if (result.childID) {
        childMessageSummaryByID.set(result.childID, result);
      }
    }
    setState((current) => {
      const next = cloneState(current);
      let changed = false;
      for (const rawSession of children) {
        const session = asRecord3(rawSession);
        if (!session || typeof session.id !== "string") continue;
        const fakeEvent = {
          type: "session.created",
          properties: {
            sessionID: session.id,
            info: session
          }
        };
        const mapped = mapOpenCodeEventToSubagentEvent(fakeEvent);
        if (mapped && processSubagentEvent(next, mapped)) changed = true;
        const status = asRecord3(allStatuses[session.id]);
        const sessionStatus = deriveSessionChildStatus(status);
        const childSummary = childMessageSummaryByID.get(session.id);
        const explicitCompletionEvidence = !!childSummary && !childSummary.fetchFailed && (typeof childSummary.completedAt === "string" || childSummary.hasError);
        const fallbackEndedAt = childSummary?.completedAt ?? childSummary?.evidenceAt;
        const statusEndedAt = fallbackEndedAt ?? session.time?.completed ?? session.time?.updated;
        if (sessionStatus === "done" || sessionStatus === "error") {
          const mappedStatus = mapOpenCodeEventToSubagentEvent({
            type: sessionStatus === "done" ? "session.idle" : "session.error",
            childID: session.id,
            endedAt: statusEndedAt
          });
          if (mappedStatus && processSubagentEvent(next, mappedStatus)) changed = true;
          continue;
        }
        if (!sessionStatus && explicitCompletionEvidence) {
          const childStatus = childSummary?.hasError ? "error" : "done";
          const mappedStatus = mapOpenCodeEventToSubagentEvent({
            type: childStatus === "done" ? "session.idle" : "session.error",
            childID: session.id,
            endedAt: fallbackEndedAt
          });
          if (mappedStatus && processSubagentEvent(next, mappedStatus)) changed = true;
        }
      }
      for (const rawMessage of messages) {
        const message = asRecord3(rawMessage);
        const info = asRecord3(message?.info);
        const parts = Array.isArray(message?.parts) ? message.parts : [];
        const parentMessageID = messageIDOf2(message);
        const isAssistant = info?.role === "assistant";
        const time = asRecord3(info?.time);
        const completedAt = timestampFromUnknown(time?.completed);
        const isCompleted = typeof completedAt === "string";
        const hasError = !!info?.error;
        for (const rawPart of parts) {
          const part = asRecord3(rawPart);
          if (!part) continue;
          const partWithMessageID = typeof part.messageID === "string" && part.messageID.length > 0 ? part : parentMessageID ? { ...part, messageID: parentMessageID } : part;
          if (part.type === "subtask" || part.type === "tool" && (part.tool === "delegate" || part.tool === "task")) {
            const fakeEvent = {
              type: "message.part.updated",
              properties: {
                sessionID: currentSessionID,
                info: time ? { time } : void 0,
                part: partWithMessageID
              }
            };
            const mapped = mapOpenCodeEventToSubagentEvent(fakeEvent);
            if (mapped && processSubagentEvent(next, mapped)) changed = true;
            if (part.type === "subtask" && isAssistant && isCompleted) {
              const childID = `subtask:${part.id}`;
              const childStatus = hasError ? "error" : "done";
              const mappedStatus = mapOpenCodeEventToSubagentEvent({
                type: childStatus === "done" ? "session.idle" : "session.error",
                childID,
                endedAt: completedAt
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
          await writeFile2(textPath, renderStatusLine(next), "utf8");
        } catch {
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

// src/adapters/presentation/tui/tui-plugin.tsx
var TUI_PLUGIN_ID = "subagent-statusline.tui";
var ELAPSED_TICK_MS = 1e3;
var SUBAGENTS_EXPANDED_KV_KEY = "subagents.sidebar.expanded";
var SUBAGENTS_SECTION_ENABLED_KV_KEY = "subagents.sidebar.enabled";
var FOCUS_MODE_KEY = "subagents.sidebar.focusMode";
var STATUS_FILTERS_KEY = "subagents.sidebar.statusFilters";
var CLOCK_ICON = "\uF017";
var TOKEN_ICON = "\uF51E";
var MODEL_ICON = "\uF040";
function statusIcon(status, uiControl) {
  if (uiControl === "stopped") return "\u25A0";
  if (uiControl === "blocked") return "\u2298";
  if (status === "done") return "\u2713";
  if (status === "error") return "\u2715";
  if (status === "waiting") return "\u25D4";
  if (status === "blocked") return "\u2298";
  if (status === "stopped") return "\u25A0";
  return "\u25CF";
}
function statusColor2(status, theme, uiControl) {
  if (uiControl === "stopped") return theme.error.toString();
  if (uiControl === "blocked") return (theme.info ?? theme.text).toString();
  if (status === "done") return theme.success.toString();
  if (status === "error") return theme.error.toString();
  if (status === "waiting") return theme.warning.toString();
  return theme.warning.toString();
}
function selectionMarker(isSelected, isFocused) {
  if (isFocused) return "\u25B6";
  if (isSelected) return "\u25CB";
  return "";
}
function ChildRow(props) {
  const line = () => formatChildRowLine(props.node.child, props.nowMs(), props.sidebarWidth(), props.isSelected, props.isFocused);
  const depth = () => props.node.depth;
  const indent = () => depth() > 0 ? "  ".repeat(depth()) : "";
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("box"), _el$3 = _$createElement("text"), _el$4 = _$createElement("text"), _el$6 = _$createElement("text"), _el$0 = _$createElement("box"), _el$1 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$0);
    _$setProp(_el$, "flexDirection", "column");
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$4);
    _$insertNode(_el$2, _el$6);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "onMouseDown", () => {
      props.onSelect(props.node.child.id);
      props.onFocus(props.node.child.id);
    });
    _$insert(_el$3, indent);
    _$insert(_el$4, () => statusIcon(line().status, line().uiControl));
    _$insert(_el$2, _$createComponent(Show, {
      get when() {
        return props.isSelected || props.isFocused;
      },
      get children() {
        var _el$5 = _$createElement("text");
        _$insert(_el$5, () => selectionMarker(props.isSelected, props.isFocused));
        _$effect((_$p) => _$setProp(_el$5, "fg", props.theme.accent, _$p));
        return _el$5;
      }
    }), _el$6);
    _$insert(_el$6, () => ` ${line().label}`);
    _$insert(_el$2, _$createComponent(Show, {
      get when() {
        return props.node.child.uiControl;
      },
      get children() {
        var _el$7 = _$createElement("text"), _el$8 = _$createTextNode(` [`), _el$9 = _$createTextNode(`]`);
        _$insertNode(_el$7, _el$8);
        _$insertNode(_el$7, _el$9);
        _$insert(_el$7, () => props.node.child.uiControl, _el$9);
        _$effect((_$p) => _$setProp(_el$7, "fg", props.theme.textMuted, _$p));
        return _el$7;
      }
    }), null);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return line().parenthetical;
      },
      children: (parenthetical) => (() => {
        var _el$15 = _$createElement("text");
        _$insert(_el$15, () => `${indent()}  ${parenthetical()}`);
        _$effect((_$p) => _$setProp(_el$15, "fg", props.theme.textMuted, _$p));
        return _el$15;
      })()
    }), _el$0);
    _$insertNode(_el$0, _el$1);
    _$setProp(_el$0, "flexDirection", "row");
    _$insert(_el$1, () => `${CLOCK_ICON} ${line().elapsed}`);
    _$insert(_el$0, _$createComponent(Show, {
      get when() {
        return line().modelBadge;
      },
      get children() {
        var _el$10 = _$createElement("text");
        _$insert(_el$10, () => ` ${MODEL_ICON} ${line().modelBadge}`);
        _$effect((_$p) => _$setProp(_el$10, "fg", props.theme.accent, _$p));
        return _el$10;
      }
    }), null);
    _$insert(_el$0, _$createComponent(Show, {
      get when() {
        return line().meta.length > 0;
      },
      get children() {
        var _el$11 = _$createElement("text");
        _$insert(_el$11, () => ` ${TOKEN_ICON} ${line().meta}`);
        _$effect((_$p) => _$setProp(_el$11, "fg", props.theme.textMuted, _$p));
        return _el$11;
      }
    }), null);
    _$insert(_el$0, _$createComponent(Show, {
      get when() {
        return props.node.child.source;
      },
      get children() {
        var _el$12 = _$createElement("text"), _el$13 = _$createTextNode(` [`), _el$14 = _$createTextNode(`]`);
        _$insertNode(_el$12, _el$13);
        _$insertNode(_el$12, _el$14);
        _$insert(_el$12, () => props.node.child.source, _el$14);
        _$effect((_$p) => _$setProp(_el$12, "fg", props.theme.textMuted, _$p));
        return _el$12;
      }
    }), null);
    _$effect((_p$) => {
      var _v$ = props.theme.textMuted, _v$2 = statusColor2(line().status, props.theme, line().uiControl), _v$3 = props.theme.text, _v$4 = 2 + depth() * 2, _v$5 = props.theme.textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$4, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$6, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp(_el$0, "paddingLeft", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp(_el$1, "fg", _v$5, _p$.i));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0
    });
    return _el$;
  })();
}
function AggregateBar(props) {
  const c = () => props.counts();
  return (() => {
    var _el$16 = _$createElement("box"), _el$17 = _$createElement("text"), _el$24 = _$createElement("text"), _el$26 = _$createElement("text");
    _$insertNode(_el$16, _el$17);
    _$insertNode(_el$16, _el$24);
    _$insertNode(_el$16, _el$26);
    _$setProp(_el$16, "flexDirection", "row");
    _$setProp(_el$16, "paddingRight", 1);
    _$setProp(_el$16, "flexShrink", 0);
    _$insert(_el$17, () => `\u25CF ${c().running}`);
    _$insert(_el$16, _$createComponent(Show, {
      get when() {
        return c().blocked > 0;
      },
      get children() {
        return [(() => {
          var _el$18 = _$createElement("text");
          _$insertNode(_el$18, _$createTextNode(` \xB7 `));
          _$effect((_$p) => _$setProp(_el$18, "fg", props.theme.textMuted, _$p));
          return _el$18;
        })(), (() => {
          var _el$20 = _$createElement("text");
          _$insert(_el$20, () => `\u2298 ${c().blocked}`);
          _$effect((_$p) => _$setProp(_el$20, "fg", props.theme.info ?? props.theme.text, _$p));
          return _el$20;
        })()];
      }
    }), _el$24);
    _$insert(_el$16, _$createComponent(Show, {
      get when() {
        return c().waiting > 0;
      },
      get children() {
        return [(() => {
          var _el$21 = _$createElement("text");
          _$insertNode(_el$21, _$createTextNode(` \xB7 `));
          _$effect((_$p) => _$setProp(_el$21, "fg", props.theme.textMuted, _$p));
          return _el$21;
        })(), (() => {
          var _el$23 = _$createElement("text");
          _$insert(_el$23, () => `\u25D4 ${c().waiting}`);
          _$effect((_$p) => _$setProp(_el$23, "fg", props.theme.warning, _$p));
          return _el$23;
        })()];
      }
    }), _el$24);
    _$insertNode(_el$24, _$createTextNode(` \xB7 `));
    _$insert(_el$26, () => `\u2713 ${c().done}`);
    _$insert(_el$16, _$createComponent(Show, {
      get when() {
        return c().error > 0;
      },
      get children() {
        return [(() => {
          var _el$27 = _$createElement("text");
          _$insertNode(_el$27, _$createTextNode(` \xB7 `));
          _$effect((_$p) => _$setProp(_el$27, "fg", props.theme.textMuted, _$p));
          return _el$27;
        })(), (() => {
          var _el$29 = _$createElement("text");
          _$insert(_el$29, () => `\u2715 ${c().error}`);
          _$effect((_$p) => _$setProp(_el$29, "fg", props.theme.error, _$p));
          return _el$29;
        })()];
      }
    }), null);
    _$insert(_el$16, _$createComponent(Show, {
      get when() {
        return c().stopped > 0;
      },
      get children() {
        return [(() => {
          var _el$30 = _$createElement("text");
          _$insertNode(_el$30, _$createTextNode(` \xB7 `));
          _$effect((_$p) => _$setProp(_el$30, "fg", props.theme.textMuted, _$p));
          return _el$30;
        })(), (() => {
          var _el$32 = _$createElement("text");
          _$insert(_el$32, () => `\u25A0 ${c().stopped}`);
          _$effect((_$p) => _$setProp(_el$32, "fg", props.theme.error, _$p));
          return _el$32;
        })()];
      }
    }), null);
    _$effect((_p$) => {
      var _v$6 = props.theme.warning, _v$7 = props.theme.textMuted, _v$8 = props.theme.success;
      _v$6 !== _p$.e && (_p$.e = _$setProp(_el$17, "fg", _v$6, _p$.e));
      _v$7 !== _p$.t && (_p$.t = _$setProp(_el$24, "fg", _v$7, _p$.t));
      _v$8 !== _p$.a && (_p$.a = _$setProp(_el$26, "fg", _v$8, _p$.a));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$16;
  })();
}
function ActionBar(props) {
  return (() => {
    var _el$33 = _$createElement("box");
    _$setProp(_el$33, "flexDirection", "row");
    _$setProp(_el$33, "paddingTop", 1);
    _$setProp(_el$33, "paddingBottom", 1);
    _$insert(_el$33, _$createComponent(Show, {
      get when() {
        return props.hasSelection();
      },
      get children() {
        return [(() => {
          var _el$34 = _$createElement("text");
          _$insertNode(_el$34, _$createTextNode(`\u2298 block`));
          _$effect((_p$) => {
            var _v$9 = props.theme.textMuted, _v$0 = props.onBlock;
            _v$9 !== _p$.e && (_p$.e = _$setProp(_el$34, "fg", _v$9, _p$.e));
            _v$0 !== _p$.t && (_p$.t = _$setProp(_el$34, "onMouseDown", _v$0, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$34;
        })(), (() => {
          var _el$36 = _$createElement("text");
          _$insertNode(_el$36, _$createTextNode(` \xB7 `));
          _$effect((_$p) => _$setProp(_el$36, "fg", props.theme.textMuted, _$p));
          return _el$36;
        })(), (() => {
          var _el$38 = _$createElement("text");
          _$insertNode(_el$38, _$createTextNode(`\u22A0 stop`));
          _$effect((_p$) => {
            var _v$1 = props.theme.error, _v$10 = props.onStop;
            _v$1 !== _p$.e && (_p$.e = _$setProp(_el$38, "fg", _v$1, _p$.e));
            _v$10 !== _p$.t && (_p$.t = _$setProp(_el$38, "onMouseDown", _v$10, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$38;
        })(), (() => {
          var _el$40 = _$createElement("text");
          _$insertNode(_el$40, _$createTextNode(` \xB7 `));
          _$effect((_$p) => _$setProp(_el$40, "fg", props.theme.textMuted, _$p));
          return _el$40;
        })(), (() => {
          var _el$42 = _$createElement("text");
          _$insertNode(_el$42, _$createTextNode(`\u2715 deselect`));
          _$effect((_p$) => {
            var _v$11 = props.theme.textMuted, _v$12 = props.onClearSelection;
            _v$11 !== _p$.e && (_p$.e = _$setProp(_el$42, "fg", _v$11, _p$.e));
            _v$12 !== _p$.t && (_p$.t = _$setProp(_el$42, "onMouseDown", _v$12, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$42;
        })(), _$createComponent(Show, {
          get when() {
            return props.hasSelection();
          },
          get children() {
            return [(() => {
              var _el$44 = _$createElement("text");
              _$insertNode(_el$44, _$createTextNode(` \xB7 `));
              _$effect((_$p) => _$setProp(_el$44, "fg", props.theme.textMuted, _$p));
              return _el$44;
            })(), (() => {
              var _el$46 = _$createElement("text"), _el$47 = _$createTextNode(`\`$\u2715 clear control\``);
              _$insertNode(_el$46, _el$47);
              _$effect((_p$) => {
                var _v$13 = props.theme.textMuted, _v$14 = props.onClear;
                _v$13 !== _p$.e && (_p$.e = _$setProp(_el$46, "fg", _v$13, _p$.e));
                _v$14 !== _p$.t && (_p$.t = _$setProp(_el$46, "onMouseDown", _v$14, _p$.t));
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$46;
            })()];
          }
        })];
      }
    }));
    return _el$33;
  })();
}
function DetailPanel(props) {
  const d = () => props.detail();
  return _$createComponent(Show, {
    get when() {
      return d();
    },
    children: (detail) => (() => {
      var _el$50 = _$createElement("box"), _el$51 = _$createElement("text"), _el$52 = _$createElement("box"), _el$53 = _$createElement("text"), _el$55 = _$createElement("text"), _el$56 = _$createElement("box"), _el$57 = _$createElement("text"), _el$59 = _$createElement("text"), _el$60 = _$createElement("box"), _el$61 = _$createElement("text"), _el$63 = _$createElement("text"), _el$64 = _$createElement("box"), _el$65 = _$createElement("text"), _el$67 = _$createElement("text"), _el$72 = _$createElement("box"), _el$73 = _$createElement("text"), _el$75 = _$createElement("text"), _el$76 = _$createElement("box"), _el$77 = _$createElement("text"), _el$79 = _$createElement("text"), _el$80 = _$createElement("box"), _el$81 = _$createElement("text"), _el$83 = _$createElement("text");
      _$insertNode(_el$50, _el$51);
      _$insertNode(_el$50, _el$52);
      _$insertNode(_el$50, _el$56);
      _$insertNode(_el$50, _el$60);
      _$insertNode(_el$50, _el$64);
      _$insertNode(_el$50, _el$72);
      _$insertNode(_el$50, _el$76);
      _$insertNode(_el$50, _el$80);
      _$setProp(_el$50, "flexDirection", "column");
      _$setProp(_el$50, "paddingTop", 1);
      _$insert(_el$51, () => `\u25B6 ${detail().title}`);
      _$insertNode(_el$52, _el$53);
      _$insertNode(_el$52, _el$55);
      _$setProp(_el$52, "flexDirection", "row");
      _$setProp(_el$52, "paddingLeft", 2);
      _$insertNode(_el$53, _$createTextNode(`id: `));
      _$insert(_el$55, () => detail().id);
      _$insertNode(_el$56, _el$57);
      _$insertNode(_el$56, _el$59);
      _$setProp(_el$56, "flexDirection", "row");
      _$setProp(_el$56, "paddingLeft", 2);
      _$insertNode(_el$57, _$createTextNode(`parentID: `));
      _$insert(_el$59, () => detail().parentID);
      _$insertNode(_el$60, _el$61);
      _$insertNode(_el$60, _el$63);
      _$setProp(_el$60, "flexDirection", "row");
      _$setProp(_el$60, "paddingLeft", 2);
      _$insertNode(_el$61, _$createTextNode(`status: `));
      _$insert(_el$63, () => detail().status, null);
      _$insert(_el$63, (() => {
        var _c$ = _$memo(() => !!detail().uiControl);
        return () => _c$() ? ` [${detail().uiControl}]` : "";
      })(), null);
      _$insertNode(_el$64, _el$65);
      _$insertNode(_el$64, _el$67);
      _$setProp(_el$64, "flexDirection", "row");
      _$setProp(_el$64, "paddingLeft", 2);
      _$insertNode(_el$65, _$createTextNode(`source: `));
      _$insert(_el$67, () => detail().source);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().model;
        },
        get children() {
          var _el$68 = _$createElement("box"), _el$69 = _$createElement("text"), _el$71 = _$createElement("text");
          _$insertNode(_el$68, _el$69);
          _$insertNode(_el$68, _el$71);
          _$setProp(_el$68, "flexDirection", "row");
          _$setProp(_el$68, "paddingLeft", 2);
          _$insertNode(_el$69, _$createTextNode(`model: `));
          _$insert(_el$71, () => detail().model);
          _$effect((_p$) => {
            var _v$15 = props.theme.textMuted, _v$16 = props.theme.text;
            _v$15 !== _p$.e && (_p$.e = _$setProp(_el$69, "fg", _v$15, _p$.e));
            _v$16 !== _p$.t && (_p$.t = _$setProp(_el$71, "fg", _v$16, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$68;
        }
      }), _el$72);
      _$insertNode(_el$72, _el$73);
      _$insertNode(_el$72, _el$75);
      _$setProp(_el$72, "flexDirection", "row");
      _$setProp(_el$72, "paddingLeft", 2);
      _$insertNode(_el$73, _$createTextNode(`elapsed: `));
      _$insert(_el$75, () => detail().elapsed);
      _$insertNode(_el$76, _el$77);
      _$insertNode(_el$76, _el$79);
      _$setProp(_el$76, "flexDirection", "row");
      _$setProp(_el$76, "paddingLeft", 2);
      _$insertNode(_el$77, _$createTextNode(`started: `));
      _$insert(_el$79, () => formatTimestamp(detail().startedAt));
      _$insertNode(_el$80, _el$81);
      _$insertNode(_el$80, _el$83);
      _$setProp(_el$80, "flexDirection", "row");
      _$setProp(_el$80, "paddingLeft", 2);
      _$insertNode(_el$81, _$createTextNode(`updated: `));
      _$insert(_el$83, () => formatTimestamp(detail().updatedAt));
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().endedAt;
        },
        get children() {
          var _el$84 = _$createElement("box"), _el$85 = _$createElement("text"), _el$87 = _$createElement("text");
          _$insertNode(_el$84, _el$85);
          _$insertNode(_el$84, _el$87);
          _$setProp(_el$84, "flexDirection", "row");
          _$setProp(_el$84, "paddingLeft", 2);
          _$insertNode(_el$85, _$createTextNode(`ended: `));
          _$insert(_el$87, () => formatTimestamp(detail().endedAt));
          _$effect((_p$) => {
            var _v$17 = props.theme.textMuted, _v$18 = props.theme.text;
            _v$17 !== _p$.e && (_p$.e = _$setProp(_el$85, "fg", _v$17, _p$.e));
            _v$18 !== _p$.t && (_p$.t = _$setProp(_el$87, "fg", _v$18, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$84;
        }
      }), null);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().tokens;
        },
        get children() {
          var _el$88 = _$createElement("box"), _el$89 = _$createElement("text"), _el$91 = _$createElement("text");
          _$insertNode(_el$88, _el$89);
          _$insertNode(_el$88, _el$91);
          _$setProp(_el$88, "flexDirection", "row");
          _$setProp(_el$88, "paddingLeft", 2);
          _$insertNode(_el$89, _$createTextNode(`tokens: `));
          _$insert(_el$91, () => formatTokenDetail(detail().tokens));
          _$effect((_p$) => {
            var _v$19 = props.theme.textMuted, _v$20 = props.theme.text;
            _v$19 !== _p$.e && (_p$.e = _$setProp(_el$89, "fg", _v$19, _p$.e));
            _v$20 !== _p$.t && (_p$.t = _$setProp(_el$91, "fg", _v$20, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$88;
        }
      }), null);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().summary;
        },
        get children() {
          var _el$92 = _$createElement("box"), _el$93 = _$createElement("text"), _el$95 = _$createElement("text");
          _$insertNode(_el$92, _el$93);
          _$insertNode(_el$92, _el$95);
          _$setProp(_el$92, "flexDirection", "row");
          _$setProp(_el$92, "paddingLeft", 2);
          _$insertNode(_el$93, _$createTextNode(`summary: `));
          _$insert(_el$95, () => detail().summary);
          _$effect((_p$) => {
            var _v$21 = props.theme.textMuted, _v$22 = props.theme.text;
            _v$21 !== _p$.e && (_p$.e = _$setProp(_el$93, "fg", _v$21, _p$.e));
            _v$22 !== _p$.t && (_p$.t = _$setProp(_el$95, "fg", _v$22, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$92;
        }
      }), null);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().errorDetail;
        },
        get children() {
          var _el$96 = _$createElement("box"), _el$97 = _$createElement("text"), _el$99 = _$createElement("text");
          _$insertNode(_el$96, _el$97);
          _$insertNode(_el$96, _el$99);
          _$setProp(_el$96, "flexDirection", "row");
          _$setProp(_el$96, "paddingLeft", 2);
          _$insertNode(_el$97, _$createTextNode(`error: `));
          _$insert(_el$99, () => detail().errorDetail);
          _$effect((_p$) => {
            var _v$23 = props.theme.textMuted, _v$24 = props.theme.error ?? props.theme.text;
            _v$23 !== _p$.e && (_p$.e = _$setProp(_el$97, "fg", _v$23, _p$.e));
            _v$24 !== _p$.t && (_p$.t = _$setProp(_el$99, "fg", _v$24, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$96;
        }
      }), null);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return _$memo(() => detail().status === "stopped")() && !detail().errorDetail;
        },
        get children() {
          var _el$100 = _$createElement("box"), _el$101 = _$createElement("text"), _el$103 = _$createElement("text");
          _$insertNode(_el$100, _el$101);
          _$insertNode(_el$100, _el$103);
          _$setProp(_el$100, "flexDirection", "row");
          _$setProp(_el$100, "paddingLeft", 2);
          _$insertNode(_el$101, _$createTextNode(`stop reason: `));
          _$insertNode(_el$103, _$createTextNode(`stopped from TUI control`));
          _$effect((_p$) => {
            var _v$25 = props.theme.textMuted, _v$26 = props.theme.warning;
            _v$25 !== _p$.e && (_p$.e = _$setProp(_el$101, "fg", _v$25, _p$.e));
            _v$26 !== _p$.t && (_p$.t = _$setProp(_el$103, "fg", _v$26, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$100;
        }
      }), null);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().lastEvent;
        },
        get children() {
          var _el$105 = _$createElement("box"), _el$106 = _$createElement("text"), _el$108 = _$createElement("text"), _el$109 = _$createTextNode(`[`), _el$110 = _$createTextNode(`] `);
          _$insertNode(_el$105, _el$106);
          _$insertNode(_el$105, _el$108);
          _$setProp(_el$105, "flexDirection", "row");
          _$setProp(_el$105, "paddingLeft", 2);
          _$insertNode(_el$106, _$createTextNode(`last event: `));
          _$insertNode(_el$108, _el$109);
          _$insertNode(_el$108, _el$110);
          _$insert(_el$108, () => formatTimestamp(detail().lastEvent.timestamp), _el$110);
          _$insert(_el$108, () => detail().lastEvent.type, null);
          _$insert(_el$108, (() => {
            var _c$2 = _$memo(() => !!detail().lastEvent.detail);
            return () => _c$2() ? ` \u2014 ${detail().lastEvent.detail}` : "";
          })(), null);
          _$effect((_p$) => {
            var _v$27 = props.theme.textMuted, _v$28 = props.theme.text;
            _v$27 !== _p$.e && (_p$.e = _$setProp(_el$106, "fg", _v$27, _p$.e));
            _v$28 !== _p$.t && (_p$.t = _$setProp(_el$108, "fg", _v$28, _p$.t));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$105;
        }
      }), null);
      _$insert(_el$50, _$createComponent(Show, {
        get when() {
          return detail().eventLog.length > 0;
        },
        get children() {
          return [(() => {
            var _el$111 = _$createElement("text");
            _$insertNode(_el$111, _$createTextNode(`timeline`));
            _$setProp(_el$111, "paddingTop", 1);
            _$effect((_$p) => _$setProp(_el$111, "fg", props.theme.text.toString(), _$p));
            return _el$111;
          })(), _$createComponent(For, {
            get each() {
              return [...detail().eventLog].reverse().slice(0, 10);
            },
            children: (entry) => (() => {
              var _el$113 = _$createElement("box"), _el$114 = _$createElement("text"), _el$115 = _$createTextNode(`[`), _el$116 = _$createTextNode(`]`), _el$117 = _$createElement("text"), _el$118 = _$createTextNode(` `);
              _$insertNode(_el$113, _el$114);
              _$insertNode(_el$113, _el$117);
              _$setProp(_el$113, "flexDirection", "row");
              _$setProp(_el$113, "paddingLeft", 2);
              _$insertNode(_el$114, _el$115);
              _$insertNode(_el$114, _el$116);
              _$insert(_el$114, () => formatTimestamp(entry.timestamp), _el$116);
              _$insertNode(_el$117, _el$118);
              _$insert(_el$117, () => entry.type, null);
              _$insert(_el$113, _$createComponent(Show, {
                get when() {
                  return entry.detail;
                },
                get children() {
                  var _el$119 = _$createElement("text"), _el$120 = _$createTextNode(` `);
                  _$insertNode(_el$119, _el$120);
                  _$insert(_el$119, () => entry.detail, null);
                  _$effect((_$p) => _$setProp(_el$119, "fg", props.theme.textMuted, _$p));
                  return _el$119;
                }
              }), null);
              _$effect((_p$) => {
                var _v$45 = props.theme.textMuted, _v$46 = props.theme.text;
                _v$45 !== _p$.e && (_p$.e = _$setProp(_el$114, "fg", _v$45, _p$.e));
                _v$46 !== _p$.t && (_p$.t = _$setProp(_el$117, "fg", _v$46, _p$.t));
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$113;
            })()
          })];
        }
      }), null);
      _$effect((_p$) => {
        var _v$29 = props.theme.border.toString(), _v$30 = props.theme.text.toString(), _v$31 = props.theme.textMuted, _v$32 = props.theme.text, _v$33 = props.theme.textMuted, _v$34 = props.theme.text, _v$35 = props.theme.textMuted, _v$36 = statusColor2(detail().status, props.theme, detail().uiControl), _v$37 = props.theme.textMuted, _v$38 = props.theme.text, _v$39 = props.theme.textMuted, _v$40 = props.theme.text, _v$41 = props.theme.textMuted, _v$42 = props.theme.text, _v$43 = props.theme.textMuted, _v$44 = props.theme.text;
        _v$29 !== _p$.e && (_p$.e = _$setProp(_el$50, "borderColor", _v$29, _p$.e));
        _v$30 !== _p$.t && (_p$.t = _$setProp(_el$51, "fg", _v$30, _p$.t));
        _v$31 !== _p$.a && (_p$.a = _$setProp(_el$53, "fg", _v$31, _p$.a));
        _v$32 !== _p$.o && (_p$.o = _$setProp(_el$55, "fg", _v$32, _p$.o));
        _v$33 !== _p$.i && (_p$.i = _$setProp(_el$57, "fg", _v$33, _p$.i));
        _v$34 !== _p$.n && (_p$.n = _$setProp(_el$59, "fg", _v$34, _p$.n));
        _v$35 !== _p$.s && (_p$.s = _$setProp(_el$61, "fg", _v$35, _p$.s));
        _v$36 !== _p$.h && (_p$.h = _$setProp(_el$63, "fg", _v$36, _p$.h));
        _v$37 !== _p$.r && (_p$.r = _$setProp(_el$65, "fg", _v$37, _p$.r));
        _v$38 !== _p$.d && (_p$.d = _$setProp(_el$67, "fg", _v$38, _p$.d));
        _v$39 !== _p$.l && (_p$.l = _$setProp(_el$73, "fg", _v$39, _p$.l));
        _v$40 !== _p$.u && (_p$.u = _$setProp(_el$75, "fg", _v$40, _p$.u));
        _v$41 !== _p$.c && (_p$.c = _$setProp(_el$77, "fg", _v$41, _p$.c));
        _v$42 !== _p$.w && (_p$.w = _$setProp(_el$79, "fg", _v$42, _p$.w));
        _v$43 !== _p$.m && (_p$.m = _$setProp(_el$81, "fg", _v$43, _p$.m));
        _v$44 !== _p$.f && (_p$.f = _$setProp(_el$83, "fg", _v$44, _p$.f));
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0,
        o: void 0,
        i: void 0,
        n: void 0,
        s: void 0,
        h: void 0,
        r: void 0,
        d: void 0,
        l: void 0,
        u: void 0,
        c: void 0,
        w: void 0,
        m: void 0,
        f: void 0
      });
      return _el$50;
    })()
  });
}
function SidebarSubagents(props) {
  const vm = createTuiViewModel(props.state, props.nowMs, true, props.statusFilters());
  vm.setStatusFiltersChangeCallback(props.onStatusFiltersChange);
  const counts = createMemo2(() => {
    const c = getCounts2(props.state());
    return c;
  });
  const children = () => {
    return collapseToolWrappers2(Object.values(props.state().children)).sort(byPriority3);
  };
  const hierarchy = () => {
    return buildHierarchy2(children(), props.sessionID);
  };
  return (() => {
    var _el$121 = _$createElement("box"), _el$122 = _$createElement("box"), _el$123 = _$createElement("text"), _el$124 = _$createElement("text"), _el$126 = _$createElement("text"), _el$128 = _$createElement("text");
    _$insertNode(_el$121, _el$122);
    _$setProp(_el$121, "flexDirection", "column");
    _$insertNode(_el$122, _el$123);
    _$insertNode(_el$122, _el$124);
    _$insertNode(_el$122, _el$126);
    _$insertNode(_el$122, _el$128);
    _$setProp(_el$122, "flexDirection", "row");
    _$setProp(_el$123, "selectable", false);
    _$insert(_el$123, () => `${props.expanded() ? "\u25BE" : "\u25B8"} Subagents`);
    _$insertNode(_el$124, _$createTextNode(` `));
    _$insert(_el$122, _$createComponent(For, {
      each: ["running", "done", "error", "blocked", "waiting", "stopped"],
      children: (status) => (() => {
        var _el$133 = _$createElement("text"), _el$134 = _$createTextNode(`[`), _el$135 = _$createTextNode(`]`);
        _$insertNode(_el$133, _el$134);
        _$insertNode(_el$133, _el$135);
        _$setProp(_el$133, "selectable", false);
        _$setProp(_el$133, "onMouseDown", () => vm.toggleStatusFilter(status));
        _$insert(_el$133, status, _el$135);
        _$effect((_$p) => _$setProp(_el$133, "fg", vm.statusFilters().has(status) ? props.theme.accent : props.theme.textMuted, _$p));
        return _el$133;
      })()
    }), _el$126);
    _$insertNode(_el$126, _$createTextNode(` `));
    _$insertNode(_el$128, _$createTextNode(`[focus]`));
    _$setProp(_el$128, "selectable", false);
    _$insert(_el$121, _$createComponent(AggregateBar, {
      counts,
      get theme() {
        return props.theme;
      }
    }), null);
    _$insert(_el$121, _$createComponent(ActionBar, {
      get theme() {
        return props.theme;
      },
      hasSelection: () => vm.selectedIds().size > 0,
      get onBlock() {
        return vm.blockSelected;
      },
      get onStop() {
        return vm.stopSelected;
      },
      get onClear() {
        return vm.clearControls;
      },
      get onClearSelection() {
        return vm.clearSelection;
      }
    }), null);
    _$insert(_el$121, _$createComponent(Show, {
      get when() {
        return props.expanded();
      },
      get children() {
        var _el$130 = _$createElement("box");
        _$setProp(_el$130, "flexDirection", "column");
        _$insert(_el$130, _$createComponent(Show, {
          get when() {
            return _$memo(() => !!props.focusMode())() && vm.focusedId();
          },
          get children() {
            return _$createComponent(DetailPanel, {
              get detail() {
                return vm.focusedDetail;
              },
              get theme() {
                return props.theme;
              },
              get nowMs() {
                return props.nowMs;
              }
            });
          }
        }), null);
        _$insert(_el$130, _$createComponent(For, {
          get each() {
            return vm.filteredChildHierarchy();
          },
          children: (node) => _$createComponent(ChildRow, {
            node,
            get nowMs() {
              return props.nowMs;
            },
            get sidebarWidth() {
              return props.sidebarWidth;
            },
            get theme() {
              return props.theme;
            },
            get isSelected() {
              return vm.selectedIds().has(node.child.id);
            },
            get isFocused() {
              return vm.focusedId() === node.child.id;
            },
            get onSelect() {
              return vm.toggleSelect;
            },
            get onFocus() {
              return vm.selectOnly;
            }
          })
        }), null);
        _$insert(_el$130, _$createComponent(Show, {
          get when() {
            return children().length === 0;
          },
          get children() {
            var _el$131 = _$createElement("text");
            _$insertNode(_el$131, _$createTextNode(`no subagents`));
            _$effect((_$p) => _$setProp(_el$131, "fg", props.theme.textMuted, _$p));
            return _el$131;
          }
        }), null);
        return _el$130;
      }
    }), null);
    _$effect((_p$) => {
      var _v$47 = props.theme.text, _v$48 = props.onToggleExpanded, _v$49 = props.theme.textMuted, _v$50 = props.theme.textMuted, _v$51 = props.focusMode() ? props.theme.accent : props.theme.textMuted, _v$52 = props.onToggleFocusMode;
      _v$47 !== _p$.e && (_p$.e = _$setProp(_el$123, "fg", _v$47, _p$.e));
      _v$48 !== _p$.t && (_p$.t = _$setProp(_el$123, "onMouseDown", _v$48, _p$.t));
      _v$49 !== _p$.a && (_p$.a = _$setProp(_el$124, "fg", _v$49, _p$.a));
      _v$50 !== _p$.o && (_p$.o = _$setProp(_el$126, "fg", _v$50, _p$.o));
      _v$51 !== _p$.i && (_p$.i = _$setProp(_el$128, "fg", _v$51, _p$.i));
      _v$52 !== _p$.n && (_p$.n = _$setProp(_el$128, "onMouseDown", _v$52, _p$.n));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0
    });
    return _el$121;
  })();
}
function HomeBottomStatus(props) {
  const counts = createMemo2(() => getCounts2(props.state()));
  const visible = createMemo2(() => counts().running > 0 || counts().error > 0 || counts().blocked > 0 || counts().waiting > 0);
  return _$createComponent(Show, {
    get when() {
      return visible();
    },
    get children() {
      var _el$136 = _$createElement("box"), _el$137 = _$createElement("box"), _el$138 = _$createElement("text"), _el$145 = _$createElement("text"), _el$147 = _$createElement("text");
      _$insertNode(_el$136, _el$137);
      _$setProp(_el$136, "paddingLeft", 1);
      _$setProp(_el$136, "paddingRight", 1);
      _$insertNode(_el$137, _el$138);
      _$insertNode(_el$137, _el$145);
      _$insertNode(_el$137, _el$147);
      _$setProp(_el$137, "flexDirection", "row");
      _$insert(_el$138, () => `\u25CF ${counts().running}`);
      _$insert(_el$137, _$createComponent(Show, {
        get when() {
          return counts().blocked > 0;
        },
        get children() {
          return [(() => {
            var _el$139 = _$createElement("text");
            _$insertNode(_el$139, _$createTextNode(` \xB7 `));
            _$effect((_$p) => _$setProp(_el$139, "fg", props.theme.textMuted, _$p));
            return _el$139;
          })(), (() => {
            var _el$141 = _$createElement("text");
            _$insert(_el$141, () => `\u2298 ${counts().blocked}`);
            _$effect((_$p) => _$setProp(_el$141, "fg", props.theme.info ?? props.theme.text, _$p));
            return _el$141;
          })()];
        }
      }), _el$145);
      _$insert(_el$137, _$createComponent(Show, {
        get when() {
          return counts().waiting > 0;
        },
        get children() {
          return [(() => {
            var _el$142 = _$createElement("text");
            _$insertNode(_el$142, _$createTextNode(` \xB7 `));
            _$effect((_$p) => _$setProp(_el$142, "fg", props.theme.textMuted, _$p));
            return _el$142;
          })(), (() => {
            var _el$144 = _$createElement("text");
            _$insert(_el$144, () => `\u25D4 ${counts().waiting}`);
            _$effect((_$p) => _$setProp(_el$144, "fg", props.theme.warning, _$p));
            return _el$144;
          })()];
        }
      }), _el$145);
      _$insertNode(_el$145, _$createTextNode(` \xB7 `));
      _$insert(_el$147, () => `\u2713 ${counts().done}`);
      _$insert(_el$137, _$createComponent(Show, {
        get when() {
          return counts().error > 0;
        },
        get children() {
          return [(() => {
            var _el$148 = _$createElement("text");
            _$insertNode(_el$148, _$createTextNode(` \xB7 `));
            _$effect((_$p) => _$setProp(_el$148, "fg", props.theme.textMuted, _$p));
            return _el$148;
          })(), (() => {
            var _el$150 = _$createElement("text");
            _$insert(_el$150, () => `\u2715 ${counts().error}`);
            _$effect((_$p) => _$setProp(_el$150, "fg", props.theme.error, _$p));
            return _el$150;
          })()];
        }
      }), null);
      _$insert(_el$137, _$createComponent(Show, {
        get when() {
          return counts().stopped > 0;
        },
        get children() {
          return [(() => {
            var _el$151 = _$createElement("text");
            _$insertNode(_el$151, _$createTextNode(` \xB7 `));
            _$effect((_$p) => _$setProp(_el$151, "fg", props.theme.textMuted, _$p));
            return _el$151;
          })(), (() => {
            var _el$153 = _$createElement("text");
            _$insert(_el$153, () => `\u25A0 ${counts().stopped}`);
            _$effect((_$p) => _$setProp(_el$153, "fg", props.theme.error, _$p));
            return _el$153;
          })()];
        }
      }), null);
      _$effect((_p$) => {
        var _v$53 = props.theme.warning, _v$54 = props.theme.textMuted, _v$55 = props.theme.success;
        _v$53 !== _p$.e && (_p$.e = _$setProp(_el$138, "fg", _v$53, _p$.e));
        _v$54 !== _p$.t && (_p$.t = _$setProp(_el$145, "fg", _v$54, _p$.t));
        _v$55 !== _p$.a && (_p$.a = _$setProp(_el$147, "fg", _v$55, _p$.a));
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0
      });
      return _el$136;
    }
  });
}
function collapseToolWrappers2(children) {
  const realChildren = children.filter((child) => child.source !== "tool");
  return children.filter((child) => {
    if (child.source !== "tool") return true;
    if (child.source === "tool" && realChildren.some((real) => real.parentID === child.parentID)) {
      return false;
    }
    return !realChildren.some((real) => real.parentID === child.parentID && real.title.toLowerCase().includes(child.title.toLowerCase()));
  });
}
function byPriority3(a, b) {
  const rank = (status) => {
    switch (status) {
      case "running":
        return 0;
      case "blocked":
        return 1;
      case "waiting":
        return 2;
      case "error":
        return 3;
      case "stopped":
        return 4;
      case "done":
        return 5;
      default:
        return 6;
    }
  };
  const diff = rank(a.status) - rank(b.status);
  if (diff !== 0) return diff;
  return b.updatedAt.localeCompare(a.updatedAt);
}
function getCounts2(state) {
  const counts = {
    running: 0,
    done: 0,
    error: 0,
    blocked: 0,
    waiting: 0,
    stopped: 0
  };
  for (const child of Object.values(state.children)) {
    switch (child.status) {
      case "running":
        counts.running += 1;
        break;
      case "done":
        counts.done += 1;
        break;
      case "error":
        counts.error += 1;
        break;
      case "blocked":
        counts.blocked += 1;
        break;
      case "waiting":
        counts.waiting += 1;
        break;
      case "stopped":
        counts.stopped += 1;
        break;
    }
  }
  return counts;
}
function buildHierarchy2(children, sessionID) {
  const result = [];
  const childMap = /* @__PURE__ */ new Map();
  for (const child of children) {
    const parent = child.parentID;
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent).push(child);
  }
  function traverse(parentID, depth) {
    const kids = childMap.get(parentID) ?? [];
    const sorted = [...kids].sort(byPriority3);
    for (const child of sorted) {
      const hasChildren = childMap.has(child.id);
      result.push({
        child,
        depth,
        isOrphan: false,
        hasChildren
      });
      if (hasChildren) traverse(child.id, depth + 1);
    }
  }
  const direct = childMap.get(sessionID) ?? [];
  const directSorted = [...direct].sort(byPriority3);
  for (const child of directSorted) {
    const hasChildren = childMap.has(child.id);
    result.push({
      child,
      depth: 0,
      isOrphan: false,
      hasChildren
    });
    if (hasChildren) traverse(child.id, 1);
  }
  const knownIds = new Set(result.map((n) => n.child.id));
  for (const child of children) {
    if (!knownIds.has(child.id) && childMap.has(child.id)) {
      result.push({
        child,
        depth: 1,
        isOrphan: true,
        hasChildren: childMap.has(child.id)
      });
    }
  }
  return result;
}
var tui = async (api) => {
  const statePath = api.state.path.directory ? `${api.state.path.directory}/subagent-status/state.json` : `${process.env.XDG_RUNTIME_DIR ?? "/tmp"}/cobies-opencode-statusline/pid-${process.pid}/state.json`;
  const textPath = statePath.replace("state.json", "status.txt");
  const [state, setState] = createSignal2({
    children: {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const [nowMs, setNowMs] = createSignal2(Date.now());
  const [subagentsExpanded, setSubagentsExpanded] = createSignal2(api.kv.get(SUBAGENTS_EXPANDED_KV_KEY, true) !== false);
  const [subagentsSectionEnabled, setSubagentsSectionEnabled] = createSignal2(api.kv.get(SUBAGENTS_SECTION_ENABLED_KV_KEY, true) !== false);
  const [focusMode, setFocusMode] = createSignal2(api.kv.get(FOCUS_MODE_KEY, false) !== false);
  const ALL_STATUSES = ["running", "done", "error", "blocked", "waiting", "stopped"];
  const defaultFilters = new Set(ALL_STATUSES);
  const storedFilters = api.kv.get(STATUS_FILTERS_KEY);
  if (storedFilters && Array.isArray(storedFilters)) {
    defaultFilters.clear();
    for (const s of storedFilters) {
      if (ALL_STATUSES.includes(s)) defaultFilters.add(s);
    }
  }
  const [statusFilters, setStatusFilters] = createSignal2(defaultFilters);
  let disposed = false;
  const setSubagentsExpandedPreference = (expanded) => {
    setSubagentsExpanded(expanded);
    api.kv.set(SUBAGENTS_EXPANDED_KV_KEY, expanded);
  };
  const setSubagentsSectionEnabledPreference = (enabled) => {
    setSubagentsSectionEnabled(enabled);
    api.kv.set(SUBAGENTS_SECTION_ENABLED_KV_KEY, enabled);
  };
  const setFocusModePreference = (enabled) => {
    setFocusMode(enabled);
    api.kv.set(FOCUS_MODE_KEY, enabled);
  };
  const setStatusFiltersPreference = (filters) => {
    setStatusFilters(filters);
    api.kv.set(STATUS_FILTERS_KEY, [...filters]);
  };
  const commandDispose = api.command.register(() => [{
    title: subagentsSectionEnabled() ? "Subagents: Disable sidebar section" : "Subagents: Enable sidebar section",
    value: "subagent-statusline.toggle-sidebar-section",
    description: "Toggle the entire subagent sidebar section",
    category: "Subagents",
    onSelect: () => setSubagentsSectionEnabledPreference(!subagentsSectionEnabled())
  }, {
    title: subagentsExpanded() ? "Subagents: Collapse list" : "Subagents: Expand list",
    value: "subagent-statusline.toggle-expanded",
    description: "Expand or collapse the subagent list",
    category: "Subagents",
    onSelect: () => setSubagentsExpandedPreference(!subagentsExpanded())
  }, {
    title: focusMode() ? "Subagents: Disable focus mode" : "Subagents: Enable focus mode",
    value: "subagent-statusline.toggle-focus-mode",
    description: "Show detail panel for focused subagent",
    category: "Subagents",
    onSelect: () => setFocusModePreference(!focusMode())
  }]);
  createEffect(() => {
    const route = api.route.current;
    const routeSessionID = route.name === "session" && typeof route.params?.sessionID === "string" ? route.params.sessionID : void 0;
    if (!routeSessionID || disposed) return;
    void (async () => {
      await hydratePreviousSubagents(api, routeSessionID, statePath, textPath, setState);
    })();
  });
  const tick = setInterval(() => {
    setNowMs(Date.now());
    setState((current) => {
      const next = cloneState(current);
      if (!hydrateTokensFromTuiState(api, next)) return current;
      persistStateSnapshot(statePath, textPath, next);
      return next;
    });
  }, ELAPSED_TICK_MS);
  const applyEvent = (event) => {
    const mapped = mapOpenCodeEventToSubagentEvent(event);
    if (!mapped) return;
    setState((current) => {
      const next = cloneState(current);
      const changed = processSubagentEvent(next, mapped);
      const hydrated = hydrateTokensFromTuiState(api, next);
      if (!changed && !hydrated) return current;
      persistStateSnapshot(statePath, textPath, next);
      return next;
    });
  };
  const disposers = [api.event.on("session.created", applyEvent), api.event.on("session.updated", applyEvent), api.event.on("session.idle", applyEvent), api.event.on("session.error", applyEvent), api.event.on("message.updated", applyEvent), api.event.on("message.part.updated", applyEvent)];
  api.lifecycle.onDispose(() => {
    disposed = true;
    clearInterval(tick);
    commandDispose();
    for (const dispose of disposers) dispose();
  });
  api.slots.register({
    slots: {
      sidebar_content(ctx) {
        const routeSessionID = api.route.current.name === "session" && typeof api.route.current.params?.sessionID === "string" ? api.route.current.params.sessionID : void 0;
        const sessionID = ctx.session_id ?? routeSessionID ?? "";
        return _$createComponent(Show, {
          get when() {
            return subagentsSectionEnabled();
          },
          get children() {
            return _$createComponent(SidebarSubagents, {
              sessionID,
              state,
              nowMs,
              expanded: subagentsExpanded,
              onToggleExpanded: () => setSubagentsExpandedPreference(!subagentsExpanded()),
              sidebarWidth: () => resolveSidebarWidth(ctx),
              get theme() {
                return ctx.theme.current;
              },
              focusMode,
              onToggleFocusMode: () => setFocusModePreference(!focusMode()),
              statusFilters,
              onStatusFiltersChange: setStatusFiltersPreference
            });
          }
        });
      },
      home_bottom(ctx) {
        return _$createComponent(HomeBottomStatus, {
          state,
          get theme() {
            return ctx.theme.current;
          }
        });
      }
    }
  });
};
function resolveSidebarWidth(ctx) {
  const source = ctx;
  if (!source) return void 0;
  const direct = toFinitePositiveInt(source.width) ?? toFinitePositiveInt(source.columns) ?? toFinitePositiveInt(source.cols);
  if (direct) return direct;
  const size = source.size;
  const viewport = source.viewport;
  const bounds = source.bounds;
  return toFinitePositiveInt(size?.width) ?? toFinitePositiveInt(viewport?.width) ?? toFinitePositiveInt(bounds?.width);
}
function toFinitePositiveInt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return void 0;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : void 0;
}
var plugin = {
  id: TUI_PLUGIN_ID,
  tui
};
var tui_plugin_default = plugin;

// src/entry/tui.tsx
var tui_default = tui_plugin_default;
export {
  tui_default as default
};
//# sourceMappingURL=tui.js.map