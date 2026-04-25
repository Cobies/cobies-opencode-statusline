import { describe, it, expect } from "vitest";
import { resolveElapsedMs } from "./elapsed-time.js";

describe("resolveElapsedMs", () => {
  it("returns 0 for invalid startedAt", () => {
    const child = {
      id: "1",
      title: "test",
      parentID: "p1",
      status: "running" as const,
      color: "yellow" as const,
      startedAt: "invalid",
      updatedAt: new Date().toISOString(),
    };
    expect(resolveElapsedMs(child, Date.now())).toBe(0);
  });

  it("returns 0 for NaN startedAt", () => {
    const child = {
      id: "1",
      title: "test",
      parentID: "p1",
      status: "running" as const,
      color: "yellow" as const,
      startedAt: "not-a-date",
      updatedAt: new Date().toISOString(),
    };
    expect(resolveElapsedMs(child, Date.now())).toBe(0);
  });

  it("calculates elapsed for running child", () => {
    const started = new Date("2024-01-01T12:00:00Z").getTime();
    const now = new Date("2024-01-01T12:01:00Z").getTime();
    const child = {
      id: "1",
      title: "test",
      parentID: "p1",
      status: "running" as const,
      color: "yellow" as const,
      startedAt: new Date(started).toISOString(),
      updatedAt: new Date(started).toISOString(),
    };
    expect(resolveElapsedMs(child, now)).toBe(60_000);
  });

  it("uses endedAt when available (done child)", () => {
    const started = new Date("2024-01-01T12:00:00Z").getTime();
    const ended = new Date("2024-01-01T12:01:00Z").getTime();
    const now = new Date("2024-01-01T12:05:00Z").getTime();
    const child = {
      id: "1",
      title: "test",
      parentID: "p1",
      status: "done" as const,
      color: "green" as const,
      startedAt: new Date(started).toISOString(),
      updatedAt: new Date(ended).toISOString(),
      endedAt: new Date(ended).toISOString(),
    };
    // Should use endedAt, not now
    expect(resolveElapsedMs(child, now)).toBe(60_000);
  });

  it("returns max(0, result) for negative durations", () => {
    const started = new Date("2024-01-01T12:01:00Z").getTime();
    const now = new Date("2024-01-01T12:00:00Z").getTime();
    const child = {
      id: "1",
      title: "test",
      parentID: "p1",
      status: "done" as const,
      color: "green" as const,
      startedAt: new Date(started).toISOString(),
      updatedAt: new Date(started).toISOString(),
      endedAt: new Date(now).toISOString(),
    };
    expect(resolveElapsedMs(child, now)).toBe(0);
  });
});