// Adapter — TUI view model (presentation logic, no JSX)

import { createSignal, createMemo, type Accessor } from "solid-js";
import type { StatuslineState, ChildSessionState, ChildStatus, StatusCounts } from "../../../domain/entities/statusline-state.js";
import { getCounts } from "../../../domain/services/state-counts.js";
import { resolveElapsedMs } from "../../../domain/services/elapsed-time.js";

export type SelectionMode = "none" | "single" | "multi";

export interface TuiViewModel {
  state: Accessor<StatuslineState>;
  nowMs: Accessor<number>;
  counts: Accessor<StatusCounts>;
  childrenForSession: (sessionID: string) => ChildSessionState[];
  otherChildren: () => ChildSessionState[];
  expanded: Accessor<boolean>;
  setExpanded: (v: boolean) => void;
  // Selection
  selectedIds: Accessor<Set<string>>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  selectOnly: (id: string) => void;
  // Focused (single)
  focusedId: Accessor<string | undefined>;
  setFocusedId: (id: string | undefined) => void;
  // Hierarchy
  childHierarchy: () => HierarchyNode[];
  filteredChildHierarchy: () => HierarchyNode[];
  focusedDetail: () => ChildDetail | undefined;
  // Status filters (view-only, does not affect runtime state)
  statusFilters: Accessor<Set<ChildStatus>>;
  setStatusFilters: (f: Set<ChildStatus>) => void;
  toggleStatusFilter: (status: ChildStatus) => void;
  setStatusFiltersChangeCallback: (fn: (filters: Set<ChildStatus>) => void) => void;
  // Actions (UI-driven, not runtime)
  blockSelected: () => void;
  stopSelected: () => void;
  clearControls: () => void;
}

export interface HierarchyNode {
  child: ChildSessionState;
  depth: number;
  isOrphan: boolean;
  hasChildren: boolean;
}

/** Full detail for the focused/selected subagent */
export interface ChildDetail {
  id: string;
  title: string;
  parentID: string;
  messageID?: string;
  source: string;
  status: ChildStatus;
  uiControl?: string;
  color: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  elapsed: string;
  elapsedMs: number;
  tokens: { input?: number; output?: number; total?: number; contextPercent?: number } | undefined;
  summary?: string;
  model?: string;
  errorDetail?: string;
  eventLog: Array<{ timestamp: string; type: string; detail?: string }>;
  lastEvent: { timestamp: string; type: string; detail?: string } | undefined;
}

const FALLBACK_SIDEBAR_WIDTH = 46;
const MIN_ROW_WIDTH = 24;
const MIN_LABEL_WIDTH = 8;

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericToolWrapper(child: ChildSessionState): boolean {
  if (child.source !== "tool") return false;
  const title = normalizeTitle(child.title);
  return title === "delegate" || title === "task";
}

function relatedTitles(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function collapseToolWrappers(children: ChildSessionState[]): ChildSessionState[] {
  const realChildren = children.filter((child) => child.source !== "tool");
  return children.filter((child) => {
    if (child.source !== "tool") return true;
    if (
      isGenericToolWrapper(child) &&
      realChildren.some((real) => real.parentID === child.parentID)
    ) {
      return false;
    }
    return !realChildren.some(
      (real) =>
        real.parentID === child.parentID && relatedTitles(real.title, child.title),
    );
  });
}

function statusRank(status: ChildStatus): number {
  switch (status) {
    case "running": return 0;
    case "blocked": return 1;
    case "waiting": return 2;
    case "error": return 3;
    case "stopped": return 4;
    case "done": return 5;
    default: return 6;
  }
}

function byPriority(a: ChildSessionState, b: ChildSessionState): number {
  const diff = statusRank(a.status) - statusRank(b.status);
  if (diff !== 0) return diff;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function formatDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resolveTokenTotal(child: ChildSessionState): number | undefined {
  const total = child.tokens?.total;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const input = child.tokens?.input;
  const output = child.tokens?.output;
  if (typeof input === "number" || typeof output === "number") {
    return Math.max(0, (input ?? 0) + (output ?? 0));
  }
  return undefined;
}

function formatCompactTokenCount(total: number): string {
  const value = Math.max(0, total);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M tok`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k tok`;
  return `${Math.round(value)} tok`;
}

function formatCompactPercent(percent: number): string {
  return `${Math.max(0, Math.round(percent))}%`;
}

/**
 * Compact a model name for display as a badge.
 * Extracts the last path segment (after /) and truncates if needed.
 * Examples:
 *   "gpt-4o-mini" → "4o-mini"
 *   "claude-3-5-sonnet-latest" → "3.5-sonnet-latest"
 *   "deepseek-chat" → "deepseek-chat"
 *   "openai/gpt-4o" → "gpt-4o"
 *   "anthropic/claude-3-5-sonnet" → "claude-3-5-sonnet"
 */
export function compactModelName(model: string | undefined, maxLen = 15): string | undefined {
  if (!model || model.length === 0) return undefined;
  // Use last path segment (e.g. "openai/gpt-4o" → "gpt-4o")
  const last = model.split("/").pop()!;
  // Strip provider prefixes if result is short enough, otherwise keep full segment
  const stripped = last.replace(/^(text-|chat-)?(gpt|claude|deepseek|llama|mistral|qwen|gemini)[-_]/i, "");
  const chosen = stripped.length < last.length && stripped.length <= maxLen ? stripped : last;
  if (chosen.length <= maxLen) return chosen;
  return chosen.slice(0, maxLen - 1) + "…";
}

function contextVariants(child: ChildSessionState): string[] {
  const total = resolveTokenTotal(child);
  const percent = child.tokens?.contextPercent;
  const hasTotal = typeof total === "number" && Number.isFinite(total);
  const hasPercent = typeof percent === "number" && Number.isFinite(percent);
  // Tokens go into meta; model goes to badge — never duplicate in meta
  if (!hasTotal && !hasPercent) return [""];
  const tokenPart = hasTotal ? formatCompactTokenCount(total) : "";
  const percentPart = hasPercent ? formatCompactPercent(percent) : "";
  const parts: string[] = [];
  if (tokenPart && percentPart) parts.push(`${tokenPart} ${percentPart}`, tokenPart, percentPart, "");
  else if (tokenPart) parts.push(tokenPart, "");
  else if (percentPart) parts.push(percentPart, "");
  return parts;
}

function splitParentheticalTitle(title: string): { label: string; parenthetical?: string } {
  const match = title.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  if (!match) return { label: title };
  const label = match[1]?.trim();
  const parenthetical = match[2]?.trim();
  if (!label || !parenthetical) return { label: title };
  return { label, parenthetical };
}

function rowWidthBudget(sidebarWidth: number | undefined): number {
  const width = sidebarWidth ?? FALLBACK_SIDEBAR_WIDTH;
  return Math.max(MIN_ROW_WIDTH, Math.min(width, 120));
}

export function elapsedMs(child: ChildSessionState, nowMs: number): number {
  if (child.status !== "running") return child.elapsedMs ?? 0;
  const started = Date.parse(child.startedAt);
  if (Number.isNaN(started)) return child.elapsedMs ?? 0;
  return Math.max(0, nowMs - started);
}

export interface FormattedChildRow {
  label: string;
  parenthetical?: string;
  elapsed: string;
  meta: string;
  status: ChildStatus;
  uiControl?: string;
  color: ChildSessionState["color"];
  isSelected: boolean;
  isFocused: boolean;
  model?: string;
  /** Compact model badge, truncated for small widths */
  modelBadge?: string;
}

export function formatChildRowLine(
  child: ChildSessionState,
  nowMs: number,
  sidebarWidth?: number,
  isSelected = false,
  isFocused = false,
): FormattedChildRow {
  const ms = elapsedMs(child, nowMs);
  const elapsed = formatDuration(ms);
  const width = rowWidthBudget(sidebarWidth);
  const title = splitParentheticalTitle(child.title);

  for (const meta of contextVariants(child)) {
    const detailChars = 2 + elapsed.length + (meta ? 3 + meta.length : 0);
    const labelBudget = Math.min(width - 2, width - Math.max(0, detailChars - width));
    if (labelBudget >= MIN_LABEL_WIDTH || meta.length === 0) {
      return {
        label: title.label.length > labelBudget
          ? `${title.label.slice(0, Math.max(0, labelBudget - 1))}…`
          : title.label,
        parenthetical: title.parenthetical,
        elapsed,
        meta,
        status: child.status,
        uiControl: child.uiControl,
        color: child.color,
        isSelected,
        isFocused,
        model: child.model,
        modelBadge: compactModelName(child.model),
      };
    }
  }

  return {
    label: title.label.length > MIN_LABEL_WIDTH
      ? `${title.label.slice(0, Math.max(0, MIN_LABEL_WIDTH - 1))}…`
      : title.label,
    parenthetical: title.parenthetical,
    elapsed,
    meta: "",
    status: child.status,
    uiControl: child.uiControl,
    color: child.color,
    isSelected,
    isFocused,
    model: child.model,
    modelBadge: compactModelName(child.model),
  };
}

/** Build hierarchy tree from flat children list, grouping by parentID */
export function buildHierarchy(
  children: ChildSessionState[],
  sessionID: string,
): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  const childMap = new Map<string, ChildSessionState[]>();

  for (const child of children) {
    const parent = child.parentID;
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent)!.push(child);
  }

  function traverse(parentID: string, depth: number): void {
    const kids = childMap.get(parentID) ?? [];
    const sorted = [...kids].sort(byPriority);
    for (const child of sorted) {
      const childId = childMap.has(child.id);
      result.push({ child, depth, isOrphan: false, hasChildren: childId });
      if (childId) traverse(child.id, depth + 1);
    }
  }

  // Direct children of session
  const direct = childMap.get(sessionID) ?? [];
  const directSorted = [...direct].sort(byPriority);
  for (const child of directSorted) {
    const childId = childMap.has(child.id);
    result.push({ child, depth: 0, isOrphan: false, hasChildren: childId });
    if (childId) traverse(child.id, 1);
  }

  // Orphans (children whose parent is not in the session's tree)
  const knownIds = new Set(result.map((n) => n.child.id));
  for (const child of children) {
    if (!knownIds.has(child.id) && childMap.has(child.id)) {
      result.push({ child, depth: 1, isOrphan: true, hasChildren: childMap.has(child.id) });
    }
  }

  return result;
}

export function formatDetail(child: ChildSessionState, nowMs: number): ChildDetail {
  const ms = elapsedMs(child, nowMs);
  const lastEvent = child.eventLog.length > 0 ? child.eventLog[child.eventLog.length - 1] : undefined;
  return {
    id: child.id,
    title: child.title,
    parentID: child.parentID,
    messageID: child.messageID,
    source: child.source ?? "session",
    status: child.status,
    uiControl: child.uiControl,
    color: child.color,
    startedAt: child.startedAt,
    updatedAt: child.updatedAt,
    endedAt: child.endedAt,
    elapsed: formatDuration(ms),
    elapsedMs: ms,
    tokens: child.tokens,
    summary: child.summary,
    model: child.model,
    errorDetail: child.errorDetail,
    eventLog: child.eventLog,
    lastEvent,
  };
}

export function createTuiViewModel(
  state: Accessor<StatuslineState>,
  nowMs: Accessor<number>,
  initialExpanded = true,
  initialStatusFilters?: Set<ChildStatus>,
): TuiViewModel {
  const [expanded, setExpanded] = createSignal(initialExpanded);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [focusedId, setFocusedId] = createSignal<string | undefined>(undefined);
  const [statusFilters, setStatusFilters] = createSignal<Set<ChildStatus>>(
    initialStatusFilters ?? new Set<ChildStatus>(["running", "done", "error", "blocked", "waiting", "stopped"]),
  );

  const counts = createMemo(() => getCounts(state()));

  const childrenForSession = (sessionID: string): ChildSessionState[] => {
    return collapseToolWrappers(
      Object.values(state().children).filter((child) => child.parentID === sessionID),
    ).sort(byPriority);
  };

  const otherChildren = (): ChildSessionState[] => {
    return collapseToolWrappers(
      Object.values(state().children),
    ).sort(byPriority);
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectOnly = (id: string): void => {
    setSelectedIds(new Set([id]));
    setFocusedId(id);
  };

  const clearSelection = (): void => {
    setSelectedIds(new Set<string>());
    setFocusedId(undefined);
  };

  const childHierarchy = (): HierarchyNode[] => {
    const sessionID = ""; // Use empty to get top-level grouping
    return buildHierarchy(otherChildren(), sessionID);
  };

  const focusedDetail = (): ChildDetail | undefined => {
    const fid = focusedId();
    if (!fid) return undefined;
    const child = state().children[fid];
    if (!child) return undefined;
    return formatDetail(child, nowMs());
  };

  // UI-only actions — these do NOT communicate with the runtime
  const blockSelected = (): void => {
    setSelectedIds((ids) => {
      // Import applyUIControl lazily to avoid circular
      for (const id of ids) {
        const child = state().children[id];
        if (!child) continue;
        if (child.status === "done" || child.status === "error") continue;
        state().children[id] = {
          ...child,
          uiControl: "blocked",
          status: "blocked",
          color: "cyan",
        };
      }
      return ids;
    });
  };

  const stopSelected = (): void => {
    setSelectedIds((ids) => {
      for (const id of ids) {
        const child = state().children[id];
        if (!child) continue;
        if (child.status === "done" || child.status === "error") continue;
        state().children[id] = {
          ...child,
          uiControl: "stopped",
          status: "stopped",
          color: "red",
        };
      }
      return ids;
    });
  };

  const clearControls = (): void => {
    for (const id of selectedIds()) {
      const child = state().children[id];
      if (!child || !child.uiControl) continue;
      const restored = child.status === "stopped" ? "running" : child.status;
      state().children[id] = {
        ...child,
        uiControl: undefined,
        status: restored,
        color: restored === "running" ? "yellow" : restored === "error" ? "red" : restored === "done" ? "green" : child.color,
      };
    }
  };

  let onStatusFiltersChange: ((filters: Set<ChildStatus>) => void) | undefined;

  const toggleStatusFilter = (status: ChildStatus): void => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      onStatusFiltersChange?.(next);
      return next;
    });
  };

  const setStatusFiltersChangeCallback = (fn: (filters: Set<ChildStatus>) => void): void => {
    onStatusFiltersChange = fn;
  };

  const filteredChildHierarchy = (): HierarchyNode[] => {
    const filters = statusFilters();
    return childHierarchy().filter((node) => filters.has(node.child.status));
  };

  return {
    state,
    nowMs,
    counts,
    childrenForSession,
    otherChildren,
    expanded,
    setExpanded,
    selectedIds,
    toggleSelect,
    clearSelection,
    selectOnly,
    focusedId,
    setFocusedId,
    childHierarchy,
    filteredChildHierarchy,
    focusedDetail,
    statusFilters,
    setStatusFilters,
    toggleStatusFilter,
    setStatusFiltersChangeCallback,
    blockSelected,
    stopSelected,
    clearControls,
  };
}

/** Format a timestamp for display: HH:MM:SS (UTC) or relative */
export function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Format token counts for detail panel */
export function formatTokenDetail(tokens: ChildTokenState | undefined): string {
  if (!tokens) return "—";
  const parts: string[] = [];
  if (tokens.input !== undefined) parts.push(`in:${tokens.input}`);
  if (tokens.output !== undefined) parts.push(`out:${tokens.output}`);
  if (tokens.total !== undefined) parts.push(`tot:${tokens.total}`);
  if (tokens.contextPercent !== undefined) parts.push(`${tokens.contextPercent}%ctx`);
  return parts.join(" ") || "—";
}

type ChildTokenState = { input?: number; output?: number; total?: number; contextPercent?: number };