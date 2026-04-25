import { describe, it, expect } from "vitest";
import { upsertRunningChild, markChildStatus, upsertChildDetails } from "./child-transitions.js";
import type { StatuslineState } from "../entities/statusline-state.js";

describe("upsertRunningChild", () => {
  it("creates new child when not exists", () => {
    const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
    const result = upsertRunningChild(state, {
      id: "child-1",
      title: "Test Child",
      parentID: "parent-1",
    });
    expect(result).toBe(true);
    expect(state.children["child-1"]).toBeDefined();
    expect(state.children["child-1"]?.status).toBe("running");
    expect(state.children["child-1"]?.title).toBe("Test Child");
  });

  it("preserves completed status when child already done", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Done Child",
          parentID: "parent-1",
          status: "done",
          color: "green",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertRunningChild(state, {
      id: "child-1",
      title: "Updated Title",
      parentID: "parent-1",
    });
    expect(result).toBe(true);
    // Status should remain done, not revert to running
    expect(state.children["child-1"]?.status).toBe("done");
  });

  it("preserves completed status when child has error", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Error Child",
          parentID: "parent-1",
          status: "error",
          color: "red",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertRunningChild(state, {
      id: "child-1",
      title: "Updated Title",
      parentID: "parent-1",
    });
    expect(result).toBe(true);
    expect(state.children["child-1"]?.status).toBe("error");
  });

  it("updates running child", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Old Title",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertRunningChild(state, {
      id: "child-1",
      title: "New Title",
      parentID: "parent-1",
    });
    expect(result).toBe(true);
    expect(state.children["child-1"]?.title).toBe("New Title");
    expect(state.children["child-1"]?.status).toBe("running");
  });
});

describe("markChildStatus", () => {
  it("marks child as done", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Child",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = markChildStatus(state, "child-1", "done", new Date().toISOString());
    expect(result).toBe(true);
    expect(state.children["child-1"]?.status).toBe("done");
    expect(state.children["child-1"]?.endedAt).toBeDefined();
  });

  it("marks child as error", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Child",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = markChildStatus(state, "child-1", "error");
    expect(result).toBe(true);
    expect(state.children["child-1"]?.status).toBe("error");
    expect(state.children["child-1"]?.color).toBe("red");
  });

  it("returns false for non-existent child", () => {
    const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
    const result = markChildStatus(state, "non-existent", "done");
    expect(result).toBe(false);
  });
});

describe("upsertChildDetails", () => {
  it("updates title", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Old Title",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertChildDetails(state, "child-1", { title: "New Title" });
    expect(result).toBe(true);
    expect(state.children["child-1"]?.title).toBe("New Title");
  });

  it("updates tokens", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Child",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertChildDetails(state, "child-1", {
      tokens: { input: 100, output: 200, total: 300 },
    });
    expect(result).toBe(true);
    expect(state.children["child-1"]?.tokens).toEqual({ input: 100, output: 200, total: 300 });
  });

  it("returns false for non-existent child", () => {
    const state: StatuslineState = { children: {}, updatedAt: new Date().toISOString() };
    const result = upsertChildDetails(state, "non-existent", { title: "New Title" });
    expect(result).toBe(false);
  });

  it("touches running child even when title is empty (shouldTouch behavior)", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Original",
          parentID: "parent-1",
          status: "running",  // running children get touched even when nothing changes
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertChildDetails(state, "child-1", { title: "" });
    // Running children are always touched to update their updatedAt
    expect(result).toBe(true);
    expect(state.children["child-1"]?.title).toBe("Original");
  });

  it("updates model", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Child",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertChildDetails(state, "child-1", { model: "gpt-4o" });
    expect(result).toBe(true);
    expect(state.children["child-1"]?.model).toBe("gpt-4o");
  });

  it("updates errorDetail", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Child",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const result = upsertChildDetails(state, "child-1", { errorDetail: "Rate limit exceeded" });
    expect(result).toBe(true);
    expect(state.children["child-1"]?.errorDetail).toBe("Rate limit exceeded");
  });

  it("preserves model and errorDetail when not provided", () => {
    const state: StatuslineState = {
      children: {
        "child-1": {
          id: "child-1",
          title: "Child",
          parentID: "parent-1",
          status: "running",
          color: "yellow",
          model: "gpt-4o",
          errorDetail: "Previous error",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    upsertChildDetails(state, "child-1", { title: "New Title" });
    expect(state.children["child-1"]?.model).toBe("gpt-4o");
    expect(state.children["child-1"]?.errorDetail).toBe("Previous error");
  });
});