import { describe, it, expect } from "vitest";
import { processSubagentEvent } from "./process-subagent-event.js";
import type { StatuslineState } from "../../domain/entities/statusline-state.js";

describe("processSubagentEvent", () => {
  describe("session.created / session.updated", () => {
    it("creates new child on session.created", () => {
      const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
      const event = {
        type: "session.created",
        childID: "ses_123",
        parentID: "parent_456",
        title: "Test Session",
        source: "session" as const,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["ses_123"]).toBeDefined();
      expect(state.children["ses_123"]?.status).toBe("running");
      expect(state.children["ses_123"]?.title).toBe("Test Session");
    });

    it("returns false when childID is missing", () => {
      const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
      const event = {
        type: "session.created",
        parentID: "parent_456",
        title: "Test Session",
      };
      expect(processSubagentEvent(state, event)).toBe(false);
    });

    it("returns false when parentID is missing", () => {
      const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
      const event = {
        type: "session.created",
        childID: "ses_123",
        title: "Test Session",
      };
      expect(processSubagentEvent(state, event)).toBe(false);
    });
  });

  describe("session.idle (done)", () => {
    it("marks child as done", () => {
      const state: StatuslineState = {
        children: {
          "ses_123": {
            id: "ses_123",
            title: "Test",
            parentID: "parent_456",
            status: "running",
            color: "yellow",
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };
      const event = {
        type: "session.idle",
        childID: "ses_123",
        sessionID: "ses_123",
        endedAt: new Date().toISOString(),
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["ses_123"]?.status).toBe("done");
      expect(state.children["ses_123"]?.color).toBe("green");
    });
  });

  describe("session.error", () => {
    it("marks child as error", () => {
      const state: StatuslineState = {
        children: {
          "ses_123": {
            id: "ses_123",
            title: "Test",
            parentID: "parent_456",
            status: "running",
            color: "yellow",
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };
      const event = {
        type: "session.error",
        childID: "ses_123",
        sessionID: "ses_123",
        endedAt: new Date().toISOString(),
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["ses_123"]?.status).toBe("error");
      expect(state.children["ses_123"]?.color).toBe("red");
    });

    it("persists model and errorDetail from event", () => {
      const state: StatuslineState = {
        children: {
          "ses_123": {
            id: "ses_123",
            title: "Test",
            parentID: "parent_456",
            status: "running",
            color: "yellow",
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };
      const event = {
        type: "session.error",
        childID: "ses_123",
        sessionID: "ses_123",
        model: "gpt-4o",
        errorDetail: "Rate limit exceeded",
        endedAt: new Date().toISOString(),
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["ses_123"]?.model).toBe("gpt-4o");
      expect(state.children["ses_123"]?.errorDetail).toBe("Rate limit exceeded");
    });
  });

  describe("message.part.updated (subtask)", () => {
    it("creates subtask child", () => {
      const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
      const event = {
        type: "message.part.updated",
        childID: "subtask:abc",
        parentID: "parent_456",
        messageID: "msg_789",
        title: "Test Subtask",
        source: "subtask" as const,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["subtask:abc"]).toBeDefined();
      expect(state.children["subtask:abc"]?.source).toBe("subtask");
    });

    it("marks tool as done when status is completed", () => {
      const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
      const event = {
        type: "message.part.updated",
        childID: "tool:xyz",
        parentID: "parent_456",
        messageID: "msg_789",
        title: "Delegate Task",
        source: "tool" as const,
        status: "done" as const,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["tool:xyz"]?.status).toBe("done");
    });
  });

  describe("message.updated (mark subtasks done)", () => {
    it("marks matching subtasks as done", () => {
      const state: StatuslineState = {
        children: {
          "subtask:abc": {
            id: "subtask:abc",
            title: "Subtask",
            parentID: "parent_456",
            messageID: "msg_789",
            source: "subtask",
            status: "running",
            color: "yellow",
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };
      const event = {
        type: "message.updated",
        sessionID: "parent_456",
        messageID: "msg_789",
      };
      const result = processSubagentEvent(state, event);
      expect(result).toBe(true);
      expect(state.children["subtask:abc"]?.status).toBe("done");
    });
  });

  it("returns false for empty type", () => {
    const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
    const event = { type: "" } as any;
    expect(processSubagentEvent(state, event)).toBe(false);
  });
});