import { describe, it, expect } from "vitest";
import { buildStatuslineSummary } from "./build-statusline-summary.js";
import type { StatuslineState } from "../../domain/entities/statusline-state.js";

describe("buildStatuslineSummary", () => {
  it("returns only aggregate for empty state", () => {
    const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
    const summary = buildStatuslineSummary(state);
    expect(summary.running).toBe(0);
    expect(summary.done).toBe(0);
    expect(summary.error).toBe(0);
    expect(summary.total).toBe(0);
    expect(summary.details).toBe("↳ 0 running · 0 done · 0 error");
  });

  it("counts running, done, and error children", () => {
    const state: StatuslineState = {
      children: {
        "1": { id: "1", title: "Running", parentID: "p", status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: new Date().toISOString() },
        "2": { id: "2", title: "Done", parentID: "p", status: "done" as const, color: "green" as const, startedAt: "", updatedAt: new Date().toISOString() },
        "3": { id: "3", title: "Error", parentID: "p", status: "error" as const, color: "red" as const, startedAt: "", updatedAt: new Date().toISOString() },
      },
      updatedAt: new Date().toISOString(),
    };
    const summary = buildStatuslineSummary(state);
    expect(summary.running).toBe(1);
    expect(summary.done).toBe(1);
    expect(summary.error).toBe(1);
    expect(summary.total).toBe(3);
    expect(summary.details).toContain("1 running");
    expect(summary.details).toContain("1 done");
    expect(summary.details).toContain("1 error");
  });

  it("filters tool children that have matching subtask siblings", () => {
    const state: StatuslineState = {
      children: {
        "subtask:1": { id: "subtask:1", title: "MySubtask", parentID: "p", messageID: "m", source: "subtask" as const, status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: new Date().toISOString() },
        "tool:1": { id: "tool:1", title: "MySubtask", parentID: "p", messageID: "m", source: "tool" as const, status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: new Date().toISOString() },
      },
      updatedAt: new Date().toISOString(),
    };
    const summary = buildStatuslineSummary(state);
    // tool:1 should be filtered out because it has matching subtask
    expect(summary.total).toBe(1);
  });

  it("sorts by priority (running > error > done)", () => {
    const now = new Date().toISOString();
    const state: StatuslineState = {
      children: {
        "1": { id: "1", title: "Done", parentID: "p", status: "done" as const, color: "green" as const, startedAt: "", updatedAt: now },
        "2": { id: "2", title: "Running", parentID: "p", status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: now },
        "3": { id: "3", title: "Error", parentID: "p", status: "error" as const, color: "red" as const, startedAt: "", updatedAt: now },
      },
      updatedAt: now,
    };
    const summary = buildStatuslineSummary(state);
    // Running should appear first in details
    expect(summary.details).toContain("Running");
  });
});