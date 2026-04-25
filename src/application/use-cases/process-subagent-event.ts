// Application — Process subagent event

import type { StatuslineState } from "../../domain/entities/statusline-state.js";
import type { SubagentEvent } from "../../domain/events/subagent-event.js";
import { mapRuntimeStatus } from "../../domain/events/subagent-event.js";
import { upsertRunningChild, markChildStatus, upsertChildDetails, appendChildEventLog } from "../../domain/services/child-transitions.js";

function makeEventEntry(event: SubagentEvent): { timestamp: string; type: string; detail?: string } {
  return {
    timestamp: event.updatedAt ?? new Date().toISOString(),
    type: event.type,
    detail: event.errorDetail ?? event.title,
  };
}

export function processSubagentEvent(
  state: StatuslineState,
  event: SubagentEvent,
): boolean {
  const { type } = event;
  if (!type) return false;

  // session-created or session-updated → upsert running child
  if (type === "session.created" || type === "session.updated") {
    if (!event.childID || !event.parentID) return false;
    const details = {
      title: event.title,
      tokens: event.tokens,
      updatedAt: event.updatedAt,
      model: event.model,
    };
    let changed = upsertRunningChild(state, {
      id: event.childID,
      title: event.title ?? "subagent",
      parentID: event.parentID,
      messageID: event.messageID,
      source: event.source ?? "session",
      startedAt: event.startedAt,
      updatedAt: event.updatedAt,
    });
    changed = upsertChildDetails(state, event.childID, details) || changed;
    // Append event to timeline
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, makeEventEntry(event));
    }
    return changed;
  }

  // session-idle → mark done
  if (type === "session.idle") {
    if (!event.childID) return false;
    const endedAt = event.endedAt ?? event.updatedAt;
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt, model: event.model, errorDetail: event.errorDetail };
    let changed = markChildStatus(state, event.childID, "done", endedAt);
    changed = upsertChildDetails(state, event.childID, details) || changed;
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, { timestamp: endedAt ?? new Date().toISOString(), type: "done", detail: event.title ?? "idle" });
    }
    return changed;
  }

  // session-error → mark error
  if (type === "session.error") {
    if (!event.childID) return false;
    const endedAt = event.endedAt ?? event.updatedAt;
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt, model: event.model, errorDetail: event.errorDetail };
    let changed = markChildStatus(state, event.childID, "error", endedAt);
    changed = upsertChildDetails(state, event.childID, details) || changed;
    if (event.eventLogEntry) {
      appendChildEventLog(state, event.childID, event.eventLogEntry);
    } else {
      appendChildEventLog(state, event.childID, { timestamp: endedAt ?? new Date().toISOString(), type: "error", detail: event.title ?? "error" });
    }
    return changed;
  }

  // subtask or tool created (message.part.updated)
  if (type === "message.part.updated") {
    if (!event.childID || !event.parentID) return false;

    // Map runtime status to extended status
    const mappedStatus = event.status ? mapRuntimeStatus(event.status) : undefined;

    let changed = upsertRunningChild(state, {
      id: event.childID,
      title: event.title ?? "subagent",
      parentID: event.parentID,
      messageID: event.messageID,
      source: event.source ?? "subtask",
      startedAt: event.startedAt,
      updatedAt: event.updatedAt,
    });

    if (mappedStatus === "done" || mappedStatus === "error") {
      const ended = event.endedAt ?? event.updatedAt;
      changed = markChildStatus(state, event.childID, mappedStatus, ended) || changed;
    } else if (mappedStatus === "waiting") {
      // Set waiting status explicitly when the runtime indicates idle/waiting
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

  // message-updated → mark subtasks done when assistant completes
  if (type === "message.updated") {
    if (!event.sessionID || !event.messageID) return false;
    // mark all subtask children matching parentID+messageID as done
    let changed = false;
    for (const child of Object.values(state.children)) {
      if (
        child.source === "subtask" &&
        child.status === "running" &&
        child.parentID === event.sessionID &&
        child.messageID === event.messageID
      ) {
        changed = markChildStatus(state, child.id, "done") || changed;
        appendChildEventLog(state, child.id, { timestamp: new Date().toISOString(), type: "done", detail: "assistant completed" });
      }
    }
    // also apply details to children
    const details = { title: event.title, tokens: event.tokens, updatedAt: event.updatedAt };
    if (state.children[event.sessionID]) {
      changed = upsertChildDetails(state, event.sessionID, details) || changed;
    }
    return changed;
  }

  return false;
}