/// <reference types="bun-types" />
// Adapter — SQLite token usage repository
// Uses bun:sqlite with proper parameterized queries (no SQL injection risk)

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import type { ChildTokenState } from "../../domain/entities/statusline-state.js";
import type { TokenUsageRepository } from "../../ports/token-usage-repository.js";

function resolveOpenCodeDataDir(): string {
  return join(process.env.XDG_DATA_HOME ?? join(os.homedir(), ".local", "share"), "opencode");
}

function resolveOpenCodeDbPath(): string {
  return process.env.OPENCODE_SUBAGENT_STATUSLINE_OPENCODE_DB ?? join(resolveOpenCodeDataDir(), "opencode.db");
}

interface TokenRow {
  tokens?: ChildTokenState;
}

function safeRead<Value>(read: () => Value): Value | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function parseTokenRow(row: string): ChildTokenState | undefined {
  try {
    const parsed = JSON.parse(row) as TokenRow;
    return parsed?.tokens;
  } catch {
    return undefined;
  }
}

// Cached database handle — initialized lazily, stays open for app lifetime
let _db: Database | undefined;

function getDb(): Database | undefined {
  if (_db) return _db;

  const dbPath = resolveOpenCodeDbPath();
  if (!existsSync(dbPath)) return undefined;

  try {
    _db = new Database(dbPath, { readonly: true, create: false });
    return _db;
  } catch {
    return undefined;
  }
}

export const sqliteTokenUsageRepository = (): TokenUsageRepository => ({
  async findBySessionId(sessionId: string): Promise<ChildTokenState | undefined> {
    const db = getDb();
    if (!db) return undefined;

    // SECURE: Uses parameterized query with ? placeholder.
    // sessionId is bound as a parameter, never interpolated into SQL string.
    // bun:sqlite internally handles the binding safely — no SQL injection possible.
    const stmt = safeRead(() =>
      db.prepare(
        `SELECT data FROM message WHERE session_id = ? AND json_extract(data, '$.tokens.total') IS NOT NULL ORDER BY time_created DESC LIMIT 1;`,
      ),
    );
    if (!stmt) return undefined;

    const row = safeRead(() => stmt.get(sessionId) as { data: string } | undefined);
    if (!row) return undefined;

    return parseTokenRow(row.data);
  },
});

// Alternative: file-based token repository for when sqlite3 CLI is not available
export const fileTokenUsageRepository = (): TokenUsageRepository => ({
  async findBySessionId(_sessionId: string): Promise<ChildTokenState | undefined> {
    // Fallback: read from opencode log files
    // Implementation would scan log directory — see original tui.tsx for pattern
    // This is a placeholder that returns undefined, letting the TUI rely on
    // in-memory token data from events rather than persistent storage.
    return undefined;
  },
});