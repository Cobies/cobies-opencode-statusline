import { describe, it, expect } from "vitest";
import { mergeTokens } from "./token-merge.js";

describe("mergeTokens", () => {
  it("returns undefined when both inputs are undefined", () => {
    expect(mergeTokens(undefined, undefined)).toBeUndefined();
  });

  it("returns existing when incoming is undefined", () => {
    const existing = { input: 100, output: 200, total: 300, contextPercent: 50 };
    expect(mergeTokens(existing, undefined)).toEqual(existing);
  });

  it("returns incoming when existing is undefined", () => {
    const incoming = { input: 100, output: 200 };
    expect(mergeTokens(undefined, incoming)).toEqual(incoming);
  });

  it("prefers incoming values over existing", () => {
    const existing = { input: 100, output: 200, total: 300, contextPercent: 50 };
    const incoming = { input: 150, output: 250, total: 400 };
    expect(mergeTokens(existing, incoming)).toEqual({
      input: 150,
      output: 250,
      total: 400,
      contextPercent: 50,
    });
  });

  it("handles partial incoming", () => {
    const existing = { input: 100, output: 200, total: 300, contextPercent: 50 };
    const incoming = { input: 150 };
    expect(mergeTokens(existing, incoming)).toEqual({
      input: 150,
      output: 200,
      total: 300,
      contextPercent: 50,
    });
  });
});