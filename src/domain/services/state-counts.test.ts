import { describe, it, expect } from "vitest";
import { getCounts } from "./state-counts.js";

describe("getCounts", () => {
  it("returns zeros for empty state", () => {
    const state = { children: {}, updatedAt: new Date().toISOString() };
    expect(getCounts(state)).toEqual({ running: 0, done: 0, error: 0, blocked: 0, waiting: 0, stopped: 0 });
  });

  it("counts running children", () => {
    const state = {
      children: {
        "1": { id: "1", title: "a", parentID: "p", status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: "" },
        "2": { id: "2", title: "b", parentID: "p", status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: "" },
      },
      updatedAt: new Date().toISOString(),
    };
    expect(getCounts(state)).toEqual({ running: 2, done: 0, error: 0, blocked: 0, waiting: 0, stopped: 0 });
  });

  it("counts done children", () => {
    const state = {
      children: {
        "1": { id: "1", title: "a", parentID: "p", status: "done" as const, color: "green" as const, startedAt: "", updatedAt: "" },
        "2": { id: "2", title: "b", parentID: "p", status: "done" as const, color: "green" as const, startedAt: "", updatedAt: "" },
        "3": { id: "3", title: "c", parentID: "p", status: "running" as const, color: "yellow" as const, startedAt: "", updatedAt: "" },
      },
      updatedAt: new Date().toISOString(),
    };
    expect(getCounts(state)).toEqual({ running: 1, done: 2, error: 0, blocked: 0, waiting: 0, stopped: 0 });
  });

  it("counts error children", () => {
    const state = {
      children: {
        "1": { id: "1", title: "a", parentID: "p", status: "error" as const, color: "red" as const, startedAt: "", updatedAt: "" },
        "2": { id: "2", title: "b", parentID: "p", status: "done" as const, color: "green" as const, startedAt: "", updatedAt: "" },
        "3": { id: "3", title: "c", parentID: "p", status: "error" as const, color: "red" as const, startedAt: "", updatedAt: "" },
      },
      updatedAt: new Date().toISOString(),
    };
    expect(getCounts(state)).toEqual({ running: 0, done: 1, error: 2, blocked: 0, waiting: 0, stopped: 0 });
  });

  it("counts blocked/waiting/stopped children", () => {
    const state = {
      children: {
        "1": { id: "1", title: "a", parentID: "p", status: "blocked" as const, color: "cyan" as const, startedAt: "", updatedAt: "" },
        "2": { id: "2", title: "b", parentID: "p", status: "waiting" as const, color: "magenta" as const, startedAt: "", updatedAt: "" },
        "3": { id: "3", title: "c", parentID: "p", status: "stopped" as const, color: "red" as const, startedAt: "", updatedAt: "" },
      },
      updatedAt: new Date().toISOString(),
    };
    expect(getCounts(state)).toEqual({ running: 0, done: 0, error: 0, blocked: 1, waiting: 1, stopped: 1 });
  });
});