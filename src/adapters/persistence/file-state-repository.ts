// Adapter — File state repository

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import os from "node:os";
import type { StatuslineState } from "../../domain/entities/statusline-state.js";
import type { StateRepository } from "../../ports/state-repository.js";
import { refreshDerivedFields } from "../../domain/services/refresh-derived.js";

const STATUS_DIRNAME = "cobies-opencode-statusline";
const STATUS_FILENAME = "state.json";

function sanitizeInstanceName(input: string): string {
  return input.replace(/[^A-Za-z0-9._-]/g, "_");
}

function resolveDefaultInstanceName(): string {
  const fromEnv = process.env.OPENCODE_SUBAGENT_STATUSLINE_INSTANCE;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    const safe = sanitizeInstanceName(fromEnv);
    if (safe.length > 0) return safe;
  }
  return `pid-${process.pid}`;
}

export function resolveStatePath(): string {
  const fromEnv = process.env.OPENCODE_SUBAGENT_STATUSLINE_STATE;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  const runtimeDir = process.env.XDG_RUNTIME_DIR ?? os.tmpdir();
  const instance = resolveDefaultInstanceName();
  return join(runtimeDir, STATUS_DIRNAME, instance, STATUS_FILENAME);
}

export function resolveTextPath(statePath: string): string {
  return join(dirname(statePath), "status.txt");
}

export function createEmptyState(): StatuslineState {
  return {
    children: {},
    updatedAt: new Date().toISOString(),
  };
}

export function shouldPreserveStateOnStartup(): boolean {
  return process.env.OPENCODE_SUBAGENT_STATUSLINE_PRESERVE_STATE === "1";
}

function loadRawState(statePath: string): Promise<StatuslineState> {
  return readFile(statePath, "utf8").then(
    (raw) => {
      const parsed = JSON.parse(raw) as Partial<StatuslineState>;
      if (!parsed || typeof parsed !== "object") {
        return createEmptyState();
      }
      const children =
        parsed.children && typeof parsed.children === "object" ? parsed.children : {};
      const state: StatuslineState = {
        children: children as Record<string, import("../../domain/entities/statusline-state.js").ChildSessionState>,
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
      return state;
    },
    () => createEmptyState(),
  );
}

export const fileStateRepository = (statePath: string): StateRepository => ({
  async load(): Promise<StatuslineState> {
    const state = await loadRawState(statePath);
    refreshDerivedFields(state);
    return state;
  },

  async save(state: StatuslineState): Promise<void> {
    refreshDerivedFields(state);
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  },
});
