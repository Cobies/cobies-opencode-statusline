import { describe, it, expect } from "vitest";
import { mapOpenCodeEventToSubagentEvent } from "./opencode-event-mapper.js";

describe("mapOpenCodeEventToSubagentEvent", () => {
  it("maps session.created event", () => {
    const event = {
      type: "session.created",
      properties: {
        info: {
          id: "ses_123",
          parentID: "parent_456",
          title: "Test Session",
          time: { started: Date.now() },
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("session.created");
    expect(result?.childID).toBe("ses_123");
    expect(result?.parentID).toBe("parent_456");
    expect(result?.title).toBe("Test Session");
    expect(result?.source).toBe("session");
  });

  it("maps session.idle to done status", () => {
    const event = {
      type: "session.idle",
      properties: {
        sessionID: "ses_123",
        info: { title: "Test" },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("session.idle");
    expect(result?.childID).toBe("ses_123");
  });

  it("maps session.error", () => {
    const event = {
      type: "session.error",
      properties: {
        sessionID: "ses_123",
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("session.error");
    expect(result?.childID).toBe("ses_123");
  });

  it("maps message.part.updated for subtask", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        sessionID: "parent_456",
        part: {
          id: "abc",
          type: "subtask",
          description: "My Subtask",
          messageID: "msg_789",
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("message.part.updated");
    expect(result?.childID).toBe("subtask:abc");
    expect(result?.source).toBe("subtask");
    expect(result?.title).toBe("My Subtask");
  });

  it("maps message.part.updated for delegate tool", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        sessionID: "parent_456",
        part: {
          id: "xyz",
          type: "tool",
          tool: "delegate",
          state: {
            status: "completed",
            title: "My Delegate",
          },
          messageID: "msg_789",
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result).not.toBeNull();
    expect(result?.childID).toBe("tool:xyz");
    expect(result?.source).toBe("tool");
    expect(result?.status).toBe("done");
  });

  it("returns null for empty type", () => {
    const event = { type: undefined };
    expect(mapOpenCodeEventToSubagentEvent(event)).toBeNull();
  });

  it("returns null for unrecognized type", () => {
    const event = { type: "some.unknown.event" };
    expect(mapOpenCodeEventToSubagentEvent(event)).toBeNull();
  });

  it("extracts token hints from event", () => {
    const event = {
      type: "session.created",
      properties: {
        info: {
          id: "ses_123",
          parentID: "parent_456",
        },
      },
    };
    // Put tokens at event level, walk should find it
    const eventWithTokens = { ...event, tokens: { total: 5000, contextPercent: 75 } };
    const result = mapOpenCodeEventToSubagentEvent(eventWithTokens);
    expect(result?.tokens?.total).toBe(5000);
    expect(result?.tokens?.contextPercent).toBe(75);
  });

  it("extracts model from part.state.model", () => {
    const event = {
      type: "session.created",
      properties: {
        info: {
          id: "ses_123",
          parentID: "parent_456",
          title: "Test",
        },
        part: {
          state: {
            model: "gpt-4o",
          },
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.model).toBe("gpt-4o");
  });

  it("extracts model from part.state.input.model", () => {
    const event = {
      type: "session.created",
      properties: {
        info: {
          id: "ses_123",
          parentID: "parent_456",
          title: "Test",
        },
        part: {
          state: {
            input: { model: "claude-3-5-sonnet" },
          },
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.model).toBe("claude-3-5-sonnet");
  });

  it("extracts model from top-level model field", () => {
    const event = {
      type: "session.created",
      model: "o3-mini",
      properties: {
        info: { id: "ses_123", parentID: "parent_456", title: "Test" },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.model).toBe("o3-mini");
  });

  it("returns undefined model when not present", () => {
    const event = {
      type: "session.created",
      properties: {
        info: { id: "ses_123", parentID: "parent_456", title: "Test" },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.model).toBeUndefined();
  });

  it("extracts errorDetail from state.error", () => {
    const event = {
      type: "session.error",
      properties: {
        sessionID: "ses_123",
        part: {
          state: {
            error: "Token limit exceeded",
          },
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.errorDetail).toBe("Token limit exceeded");
    expect(result?.status).toBe("error");
  });

  it("extracts errorDetail from input.reason", () => {
    const event = {
      type: "message.part.updated",
      properties: {
        sessionID: "parent_456",
        part: {
          id: "xyz",
          type: "tool",
          tool: "delegate",
          state: {
            status: "completed",
            input: { reason: "User cancelled" },
          },
          messageID: "msg_789",
        },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.errorDetail).toBe("User cancelled");
  });

  it("extracts errorDetail from top-level event.error", () => {
    const event = {
      type: "session.error",
      error: "Connection refused",
      properties: { sessionID: "ses_123" },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.errorDetail).toBe("Connection refused");
  });

  it("eventLogEntry detail uses errorDetail when available", () => {
    const event = {
      type: "session.error",
      properties: {
        sessionID: "ses_123",
        part: { state: { error: "Out of credits" } },
      },
    };
    const result = mapOpenCodeEventToSubagentEvent(event);
    expect(result?.eventLogEntry?.detail).toBe("Out of credits");
  });
});