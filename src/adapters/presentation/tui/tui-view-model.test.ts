import { describe, it, expect } from "vitest";
import {
  formatChildRowLine,
  elapsedMs,
  createTuiViewModel,
  buildHierarchy,
  formatDuration,
  formatTimestamp,
  formatTokenDetail,
  compactModelName,
} from "./tui-view-model.js";
import type { ChildSessionState, StatuslineState, ChildStatus } from "../../../domain/entities/statusline-state.js";

describe("elapsedMs", () => {
  it("returns elapsedMs for done/error children", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Done",
      parentID: "p",
      status: "done",
      color: "green",
      startedAt: new Date("2024-01-01T12:00:00Z").toISOString(),
      updatedAt: new Date("2024-01-01T12:01:00Z").toISOString(),
      endedAt: new Date("2024-01-01T12:01:00Z").toISOString(),
      elapsedMs: 60000,
      eventLog: [],
    };
    const now = new Date("2024-01-01T12:05:00Z").getTime();
    expect(elapsedMs(child, now)).toBe(60000);
  });

  it("calculates running elapsed from startedAt", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Running",
      parentID: "p",
      status: "running",
      color: "yellow",
      startedAt: new Date("2024-01-01T12:00:00Z").toISOString(),
      updatedAt: new Date("2024-01-01T12:00:00Z").toISOString(),
      eventLog: [],
    };
    const now = new Date("2024-01-01T12:01:00Z").getTime();
    expect(elapsedMs(child, now)).toBe(60000);
  });
});

describe("formatChildRowLine", () => {
  it("formats running child with elapsed time", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "My Task",
      parentID: "p",
      status: "running",
      color: "yellow",
      startedAt: new Date("2024-01-01T12:00:00Z").toISOString(),
      updatedAt: new Date("2024-01-01T12:00:00Z").toISOString(),
      eventLog: [],
    };
    const now = new Date("2024-01-01T12:01:30Z").getTime();
    const result = formatChildRowLine(child, now);
    expect(result.label).toBe("My Task");
    expect(result.elapsed).toBe("01:30");
    expect(result.status).toBe("running");
    expect(result.color).toBe("yellow");
  });

  it("truncates long titles", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "This is a very long task title that should be truncated",
      parentID: "p",
      status: "done",
      color: "green",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventLog: [],
    };
    const result = formatChildRowLine(child, Date.now(), 40);
    expect(result.label.length).toBeLessThanOrEqual(40);
    expect(result.label).toContain("…");
  });

  it("includes parenthetical", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Task (extra info)",
      parentID: "p",
      status: "running",
      color: "yellow",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventLog: [],
    };
    const result = formatChildRowLine(child, Date.now());
    expect(result.parenthetical).toBe("(extra info)");
  });

  it("formats with meta (tokens)", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Task",
      parentID: "p",
      status: "done",
      color: "green",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tokens: { total: 5000, contextPercent: 75 },
      eventLog: [],
    };
    const result = formatChildRowLine(child, Date.now(), 80);
    expect(result.meta).toContain("tok");
  });

  it("shows uiControl badge when set", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Task",
      parentID: "p",
      status: "blocked",
      color: "cyan",
      uiControl: "blocked",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventLog: [],
    };
    const result = formatChildRowLine(child, Date.now());
    expect(result.uiControl).toBe("blocked");
    expect(result.status).toBe("blocked");
  });

  it("includes modelBadge when model is set", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Task",
      parentID: "p",
      status: "done",
      color: "green",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: "gpt-4o-mini",
      eventLog: [],
    };
    const result = formatChildRowLine(child, Date.now(), 80);
    expect(result.modelBadge).toBe("4o-mini");
    expect(result.model).toBe("gpt-4o-mini");
  });

  it("modelBadge is undefined when model is absent", () => {
    const child: ChildSessionState = {
      id: "1",
      title: "Task",
      parentID: "p",
      status: "done",
      color: "green",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventLog: [],
    };
    const result = formatChildRowLine(child, Date.now());
    expect(result.model).toBeUndefined();
    expect(result.modelBadge).toBeUndefined();
  });
});

describe("formatDuration", () => {
  it("formats HH:MM:SS for long durations", () => {
    expect(formatDuration(3661000)).toBe("01:01:01");
  });
  it("formats MM:SS for short durations", () => {
    expect(formatDuration(90000)).toBe("01:30");
  });
});

describe("formatTimestamp", () => {
  it("formats ISO string as HH:MM:SS", () => {
    const d = new Date("2024-01-01T12:34:56Z");
    expect(formatTimestamp(d.toISOString())).toBe("12:34:56");
  });
  it("returns — for invalid input", () => {
    expect(formatTimestamp("")).toBe("—");
    expect(formatTimestamp("not-a-date")).toBe("—");
  });
});

describe("formatTokenDetail", () => {
  it("formats token info", () => {
    expect(formatTokenDetail({ input: 100, output: 200, total: 300 })).toBe("in:100 out:200 tot:300");
  });
  it("returns — for undefined", () => {
    expect(formatTokenDetail(undefined)).toBe("—");
  });
});

describe("compactModelName", () => {
  it("strips provider prefix for short names", () => {
    expect(compactModelName("gpt-4o-mini")).toBe("4o-mini");
    expect(compactModelName("deepseek-chat")).toBe("chat");
  });
  it("returns undefined for empty input", () => {
    expect(compactModelName(undefined)).toBeUndefined();
    expect(compactModelName("")).toBeUndefined();
  });
  it("uses last segment for org/model names", () => {
    expect(compactModelName("openai/gpt-4o")).toBe("4o");
    expect(compactModelName("anthropic/claude-3-5-sonnet")).toBe("3-5-sonnet");
  });
  it("truncates very long names", () => {
    expect(compactModelName("very-long-model-name-that-exceeds-limit")).toBe("very-long-mode…");
  });
});

describe("buildHierarchy", () => {
  const makeChild = (
    id: string,
    parentID: string,
    status: ChildSessionState["status"] = "running",
  ): ChildSessionState => ({
    id,
    title: id,
    parentID,
    status,
    color: "yellow",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    eventLog: [],
  });

  it("groups children by parentID", () => {
    const children = [
      makeChild("a", "session1"),
      makeChild("b", "session1"),
      makeChild("c", "a"),
    ];
    const result = buildHierarchy(children, "session1");
    expect(result.length).toBe(3);
    // a is first (depth 0)
    expect(result[0].child.id).toBe("a");
    expect(result[0].depth).toBe(0);
    expect(result[0].hasChildren).toBe(true);
    // c is child of a (depth 1)
    expect(result[1].child.id).toBe("c");
    expect(result[1].depth).toBe(1);
    // b is at depth 0
    expect(result[2].child.id).toBe("b");
    expect(result[2].depth).toBe(0);
  });

  it("sorts by status priority", () => {
    const children = [
      makeChild("a", "session1", "done"),
      makeChild("b", "session1", "running"),
      makeChild("c", "session1", "error"),
    ];
    const result = buildHierarchy(children, "session1");
    expect(result[0].child.id).toBe("b"); // running first
    expect(result[1].child.id).toBe("c"); // error second
    expect(result[2].child.id).toBe("a"); // done last
  });
});

describe("status filter integration", () => {
  const ALL_STATUSES: ChildStatus[] = ["running", "done", "error", "blocked", "waiting", "stopped"];

  // Note: buildHierarchy with sessionID="" treats children with parentID="" as top-level
  const makeChild = (
    id: string,
    parentID: string,
    status: ChildSessionState["status"] = "running",
  ): ChildSessionState => ({
    id,
    title: id,
    parentID,
    status,
    color: "yellow",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    eventLog: [],
  });

  const makeState = (children: ChildSessionState[]): StatuslineState => ({
    children: Object.fromEntries(children.map((c) => [c.id, c])),
    updatedAt: new Date().toISOString(),
  });

  it("filteredChildHierarchy excludes nodes not in active filters", () => {
    // Use parentID="" so children appear at top level in buildHierarchy with sessionID=""
    const children = [
      makeChild("a", "", "running"),
      makeChild("b", "", "done"),
      makeChild("c", "", "error"),
    ];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set(["running"] as ChildStatus[]));
    const result = vm.filteredChildHierarchy();
    expect(result.map((n) => n.child.id)).toEqual(["a"]);
  });

  it("filteredChildHierarchy returns all when all statuses are active", () => {
    const children = [
      makeChild("a", "", "running"),
      makeChild("b", "", "done"),
      makeChild("c", "", "error"),
    ];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set(ALL_STATUSES));
    const result = vm.filteredChildHierarchy();
    expect(result.map((n) => n.child.id)).toContainEqual("a");
    expect(result.map((n) => n.child.id)).toContainEqual("b");
    expect(result.map((n) => n.child.id)).toContainEqual("c");
    expect(result.length).toBe(3);
  });

  it("filteredChildHierarchy returns empty when no statuses are active", () => {
    const children = [
      makeChild("a", "", "running"),
      makeChild("b", "", "done"),
    ];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set([] as ChildStatus[]));
    const result = vm.filteredChildHierarchy();
    expect(result.map((n) => n.child.id)).toEqual([]);
  });

  it("toggleStatusFilter adds status when not present", () => {
    const children = [makeChild("a", "", "running")];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set(["running"] as ChildStatus[]));
    expect(vm.statusFilters().has("done")).toBe(false);
    vm.toggleStatusFilter("done");
    expect(vm.statusFilters().has("done")).toBe(true);
  });

  it("toggleStatusFilter removes status when present", () => {
    const children = [makeChild("a", "", "running")];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set(["running", "done"] as ChildStatus[]));
    expect(vm.statusFilters().has("done")).toBe(true);
    vm.toggleStatusFilter("done");
    expect(vm.statusFilters().has("done")).toBe(false);
  });

  it("setStatusFilters directly replaces all filters", () => {
    const children = [makeChild("a", "", "running")];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set(["running"] as ChildStatus[]));
    vm.setStatusFilters(new Set(["error", "blocked"] as ChildStatus[]));
    expect(vm.statusFilters().has("running")).toBe(false);
    expect(vm.statusFilters().has("error")).toBe(true);
    expect(vm.statusFilters().has("blocked")).toBe(true);
  });

  it("filteredChildHierarchy re-evaluates after toggle", () => {
    const children = [
      makeChild("a", "", "running"),
      makeChild("b", "", "done"),
    ];
    const state = makeState(children);
    const vm = createTuiViewModel(() => state, () => Date.now(), true, new Set(["running"] as ChildStatus[]));
    expect(vm.filteredChildHierarchy().map((n) => n.child.id)).toEqual(["a"]);
    vm.toggleStatusFilter("done");
    expect(vm.filteredChildHierarchy().map((n) => n.child.id)).toEqual(["a", "b"]);
  });
});