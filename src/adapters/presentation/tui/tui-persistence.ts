// TUI persistence helpers

import type { StatuslineState } from "../../../domain/entities/statusline-state.js";
import { renderStatusLine } from "../../../application/use-cases/build-statusline-summary.js";
import { refreshDerivedFields } from "../../../domain/services/refresh-derived.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export { renderStatusLine };

export async function saveState(
  statePath: string,
  state: StatuslineState,
): Promise<void> {
  refreshDerivedFields(state);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

export function cloneState(state: StatuslineState): StatuslineState {
  return {
    updatedAt: state.updatedAt,
    children: Object.fromEntries(
      Object.entries(state.children).map(([id, child]: [string, typeof state.children[string]]) => [
        id,
        {
          ...child,
          tokens: child.tokens ? { ...child.tokens } : undefined,
        },
      ]),
    ),
  };
}

export function persistStateSnapshot(
  statePath: string,
  textPath: string,
  state: StatuslineState,
): void {
  const snapshot = cloneState(state);
  void (async () => {
    try {
      await saveState(statePath, snapshot);
      await writeFile(textPath, renderStatusLine(snapshot), "utf8");
    } catch {
      // Persistence is best-effort; TUI rendering must not fail because of files.
    }
  })();
}