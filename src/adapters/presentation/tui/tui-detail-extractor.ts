// TUI detail extractor (pure, no side effects)

import type { ChildTokenState } from "../../../domain/entities/statusline-state.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizePercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

export function extractChildDetails(event: unknown): {
  title?: string;
  tokens?: ChildTokenState;
  updatedAt?: string;
} {
  const details: { title?: string; tokens?: ChildTokenState; updatedAt?: string } = {};

  const walk = (node: unknown, depth: number): void => {
    if (!asRecord(node) || depth > 6) return;

    const rec = node as Record<string, unknown>;

    // Try to extract title
    if (!details.title) {
      const props = rec.properties as Record<string, unknown> | undefined;
      const info = props?.info as Record<string, unknown> | undefined;
      const candidates = [
        info?.title,
        props?.title,
        info?.name,
        props?.name,
        rec.title,
        rec.name,
      ];
      for (const candidate of candidates) {
        const title = asString(candidate);
        if (title) {
          details.title = title;
          break;
        }
      }
    }

    const tokenHints: ChildTokenState = {};
    const visited = new Set<object>();

    const walkEntries = (obj: Record<string, unknown>, d: number): void => {
      if (!asRecord(obj) || d > 6) return;
      if (visited.has(obj)) return;
      visited.add(obj);

      for (const [rawKey, rawValue] of Object.entries(obj)) {
        const key = rawKey.toLowerCase();
        const asNumber =
          typeof rawValue === "number"
            ? rawValue
            : typeof rawValue === "string" && rawValue.trim().length > 0
              ? Number(rawValue)
              : undefined;

        if (typeof asNumber === "number" && Number.isFinite(asNumber)) {
          if (key.includes("context") && (key.includes("percent") || key.includes("usage"))) {
            tokenHints.contextPercent = normalizePercent(asNumber);
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
          walkEntries(rawValue as Record<string, unknown>, d + 1);
        }
      }
    };

    walkEntries(rec, depth);

    if (
      tokenHints.input !== undefined ||
      tokenHints.output !== undefined ||
      tokenHints.total !== undefined ||
      tokenHints.contextPercent !== undefined
    ) {
      details.tokens = tokenHints;
    }
  };

  walk(event, 0);

  return details;
}