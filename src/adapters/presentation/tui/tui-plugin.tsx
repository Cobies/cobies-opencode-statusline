// Adapter — TUI plugin (pure presentation, uses view model)

import type {
  TuiPlugin,
  TuiPluginApi,
  TuiPluginModule,
  TuiSlotContext,
  TuiThemeCurrent,
} from "@opencode-ai/plugin/tui";
import { For, Show, createEffect, createSignal, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { mapOpenCodeEventToSubagentEvent } from "../../opencode/opencode-event-mapper.js";
import { processSubagentEvent } from "../../../application/use-cases/process-subagent-event.js";
import {
  createTuiViewModel,
  formatChildRowLine,
  elapsedMs,
  formatTimestamp,
  formatTokenDetail,
  formatDuration,
  type FormattedChildRow,
  type ChildDetail,
} from "./tui-view-model.js";
import type { ChildSessionState, StatuslineState, StatusCounts, ChildStatus } from "../../../domain/entities/statusline-state.js";
import { cloneState } from "./tui-clone.js";
import { hydrateTokensFromTuiState } from "./tui-token-hydration.js";
import { hydratePreviousSubagents } from "./tui-hydration.js";
import { persistStateSnapshot } from "./tui-persistence.js";

const TUI_PLUGIN_ID = "subagent-statusline.tui";
const ELAPSED_TICK_MS = 1000;
const SUBAGENTS_EXPANDED_KV_KEY = "subagents.sidebar.expanded";
const SUBAGENTS_SECTION_ENABLED_KV_KEY = "subagents.sidebar.enabled";
const FOCUS_MODE_KEY = "subagents.sidebar.focusMode";
const STATUS_FILTERS_KEY = "subagents.sidebar.statusFilters";

type SidebarContentContext = TuiSlotContext & { session_id?: string };
type HomeBottomContext = TuiSlotContext;

const CLOCK_ICON = "";
const TOKEN_ICON = "";
const MODEL_ICON = "";
const SELECT_ICON = "◉";
const BLOCK_ICON = "⊘";
const STOP_ICON = "⊠";
const CLEAR_ICON = "✕";

function statusIcon(status: ChildSessionState["status"], uiControl?: string): string {
  if (uiControl === "stopped") return "■";
  if (uiControl === "blocked") return "⊘";
  if (status === "done") return "✓";
  if (status === "error") return "✕";
  if (status === "waiting") return "◔";
  if (status === "blocked") return "⊘";
  if (status === "stopped") return "■";
  return "●";
}

function statusColor(
  status: ChildSessionState["status"],
  theme: TuiThemeCurrent,
  uiControl?: string,
): string {
  if (uiControl === "stopped") return theme.error.toString();
  if (uiControl === "blocked") return (theme.info ?? theme.text).toString();
  if (status === "done") return theme.success.toString();
  if (status === "error") return theme.error.toString();
  if (status === "waiting") return theme.warning.toString();
  return theme.warning.toString();
}

function selectionMarker(isSelected: boolean, isFocused: boolean): string {
  if (isFocused) return "▶";
  if (isSelected) return "○";
  return "";
}

interface ChildRowProps {
  node: HierarchyNode;
  nowMs: Accessor<number>;
  sidebarWidth: Accessor<number | undefined>;
  theme: TuiThemeCurrent;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

function ChildRow(props: ChildRowProps) {
  const line = (): FormattedChildRow =>
    formatChildRowLine(
      props.node.child,
      props.nowMs(),
      props.sidebarWidth(),
      props.isSelected,
      props.isFocused,
    );

  const depth = () => props.node.depth;
  const indent = () => (depth() > 0 ? "  ".repeat(depth()) : "");

  return (
    <box flexDirection="column">
      <box
        flexDirection="row"
        onMouseDown={() => {
          props.onSelect(props.node.child.id);
          props.onFocus(props.node.child.id);
        }}
      >
        <text fg={props.theme.textMuted}>{indent()}</text>
        <text fg={statusColor(line().status, props.theme, line().uiControl)}>
          {statusIcon(line().status, line().uiControl)}
        </text>
        <Show when={props.isSelected || props.isFocused}>
          <text fg={props.theme.accent}>{selectionMarker(props.isSelected, props.isFocused)}</text>
        </Show>
        <text fg={props.theme.text}>{` ${line().label}`}</text>
        <Show when={props.node.child.uiControl}>
          <text fg={props.theme.textMuted}> [{props.node.child.uiControl}]</text>
        </Show>
      </box>
      <Show when={line().parenthetical}>
        {(parenthetical: Accessor<string>) => (
          <text fg={props.theme.textMuted}>{`${indent()}  ${parenthetical()}`}</text>
        )}
      </Show>
      <box flexDirection="row" paddingLeft={2 + depth() * 2}>
        <text fg={props.theme.textMuted}>{`${CLOCK_ICON} ${line().elapsed}`}</text>
        <Show when={line().modelBadge}>
          <text fg={props.theme.accent}>{` ${MODEL_ICON} ${line().modelBadge}`}</text>
        </Show>
        <Show when={line().meta.length > 0}>
          <text fg={props.theme.textMuted}>{` ${TOKEN_ICON} ${line().meta}`}</text>
        </Show>
        <Show when={props.node.child.source}>
          <text fg={props.theme.textMuted}> [{props.node.child.source}]</text>
        </Show>
      </box>
    </box>
  );
}

interface AggregateBarProps {
  counts: Accessor<StatusCounts>;
  theme: TuiThemeCurrent;
}

function AggregateBar(props: AggregateBarProps) {
  const c = () => props.counts();
  return (
    <box flexDirection="row" paddingRight={1} flexShrink={0}>
      <text fg={props.theme.warning}>{`● ${c().running}`}</text>
      <Show when={c().blocked > 0}>
        <text fg={props.theme.textMuted}> · </text>
        <text fg={props.theme.info ?? props.theme.text}>{`⊘ ${c().blocked}`}</text>
      </Show>
      <Show when={c().waiting > 0}>
        <text fg={props.theme.textMuted}> · </text>
        <text fg={props.theme.warning}>{`◔ ${c().waiting}`}</text>
      </Show>
      <text fg={props.theme.textMuted}> · </text>
      <text fg={props.theme.success}>{`✓ ${c().done}`}</text>
      <Show when={c().error > 0}>
        <text fg={props.theme.textMuted}> · </text>
        <text fg={props.theme.error}>{`✕ ${c().error}`}</text>
      </Show>
      <Show when={c().stopped > 0}>
        <text fg={props.theme.textMuted}> · </text>
        <text fg={props.theme.error}>{`■ ${c().stopped}`}</text>
      </Show>
    </box>
  );
}

interface ActionBarProps {
  theme: TuiThemeCurrent;
  hasSelection: Accessor<boolean>;
  onBlock: () => void;
  onStop: () => void;
  onClear: () => void;
  onClearSelection: () => void;
}

function ActionBar(props: ActionBarProps) {
  return (
    <box flexDirection="row" paddingTop={1} paddingBottom={1}>
      <Show when={props.hasSelection()}>
        <text
          fg={props.theme.textMuted}
          onMouseDown={props.onBlock}
        >{`${BLOCK_ICON} block`}</text>
        <text fg={props.theme.textMuted}> · </text>
        <text
          fg={props.theme.error}
          onMouseDown={props.onStop}
        >{`${STOP_ICON} stop`}</text>
        <text fg={props.theme.textMuted}> · </text>
        <text
          fg={props.theme.textMuted}
          onMouseDown={props.onClearSelection}
        >{`${CLEAR_ICON} deselect`}</text>
        <Show when={props.hasSelection()}>
          <text fg={props.theme.textMuted}> · </text>
          <text
            fg={props.theme.textMuted}
            onMouseDown={props.onClear}
          >`${CLEAR_ICON} clear control`</text>
        </Show>
      </Show>
    </box>
  );
}

interface DetailPanelProps {
  detail: Accessor<ChildDetail | undefined>;
  theme: TuiThemeCurrent;
  nowMs: Accessor<number>;
}

function DetailPanel(props: DetailPanelProps) {
  const d = () => props.detail();

  return (
    <Show when={d()}>
      {(detail: () => ChildDetail) => (
        <box flexDirection="column" paddingTop={1} borderColor={props.theme.border.toString()}>
          <text fg={props.theme.text.toString()}>{`▶ ${detail().title}`}</text>

          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>id: </text>
            <text fg={props.theme.text}>{detail().id}</text>
          </box>
          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>parentID: </text>
            <text fg={props.theme.text}>{detail().parentID}</text>
          </box>
          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>status: </text>
            <text fg={statusColor(detail().status as any, props.theme, detail().uiControl as any)}>
              {detail().status}{detail().uiControl ? ` [${detail().uiControl}]` : ""}
            </text>
          </box>
          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>source: </text>
            <text fg={props.theme.text}>{detail().source}</text>
          </box>
          <Show when={detail().model}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>model: </text>
              <text fg={props.theme.text}>{detail().model}</text>
            </box>
          </Show>
          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>elapsed: </text>
            <text fg={props.theme.text}>{detail().elapsed}</text>
          </box>
          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>started: </text>
            <text fg={props.theme.text}>{formatTimestamp(detail().startedAt)}</text>
          </box>
          <box flexDirection="row" paddingLeft={2}>
            <text fg={props.theme.textMuted}>updated: </text>
            <text fg={props.theme.text}>{formatTimestamp(detail().updatedAt)}</text>
          </box>
          <Show when={detail().endedAt}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>ended: </text>
              <text fg={props.theme.text}>{formatTimestamp(detail().endedAt!)}</text>
            </box>
          </Show>
          <Show when={detail().tokens}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>tokens: </text>
              <text fg={props.theme.text}>{formatTokenDetail(detail().tokens)}</text>
            </box>
          </Show>
          <Show when={detail().summary}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>summary: </text>
              <text fg={props.theme.text}>{detail().summary}</text>
            </box>
          </Show>
          <Show when={detail().errorDetail}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>error: </text>
              <text fg={props.theme.error ?? props.theme.text}>{detail().errorDetail}</text>
            </box>
          </Show>
          <Show when={detail().status === "stopped" && !detail().errorDetail}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>stop reason: </text>
              <text fg={props.theme.warning}>stopped from TUI control</text>
            </box>
          </Show>

          <Show when={detail().lastEvent}>
            <box flexDirection="row" paddingLeft={2}>
              <text fg={props.theme.textMuted}>last event: </text>
              <text fg={props.theme.text}>
                [{formatTimestamp(detail().lastEvent!.timestamp)}] {detail().lastEvent!.type}
                {detail().lastEvent!.detail ? ` — ${detail().lastEvent!.detail}` : ""}
              </text>
            </box>
          </Show>

          <Show when={detail().eventLog.length > 0}>
            <text fg={props.theme.text.toString()} paddingTop={1}>timeline</text>
            <For each={[...detail().eventLog].reverse().slice(0, 10)}>
              {(entry) => (
                <box flexDirection="row" paddingLeft={2}>
                  <text fg={props.theme.textMuted}>[{formatTimestamp(entry.timestamp)}]</text>
                  <text fg={props.theme.text}> {entry.type}</text>
                  <Show when={entry.detail}>
                    <text fg={props.theme.textMuted}> {entry.detail}</text>
                  </Show>
                </box>
              )}
            </For>
          </Show>
        </box>
      )}
    </Show>
  );
}

function SidebarSubagents(props: {
  sessionID: string;
  state: Accessor<StatuslineState>;
  nowMs: Accessor<number>;
  expanded: Accessor<boolean>;
  onToggleExpanded: () => void;
  sidebarWidth: Accessor<number | undefined>;
  theme: TuiThemeCurrent;
  focusMode: Accessor<boolean>;
  onToggleFocusMode: () => void;
  statusFilters: Accessor<Set<ChildStatus>>;
  onStatusFiltersChange: (filters: Set<ChildStatus>) => void;
}) {
  const vm = createTuiViewModel(props.state, props.nowMs, true, props.statusFilters());
  vm.setStatusFiltersChangeCallback(props.onStatusFiltersChange);

  const counts = createMemo(() => {
    const c = getCounts(props.state());
    return c;
  });

  const children = (): ChildSessionState[] => {
    return collapseToolWrappers(
      Object.values(props.state().children),
    ).sort(byPriority);
  };

  const hierarchy = (): HierarchyNode[] => {
    return buildHierarchy(children(), props.sessionID);
  };

  return (
    <box flexDirection="column">
      <box flexDirection="row">
        <text
          fg={props.theme.text}
          selectable={false}
          onMouseDown={props.onToggleExpanded}
        >{`${props.expanded() ? "▾" : "▸"} Subagents`}</text>
        <text fg={props.theme.textMuted}> </text>
        <For each={["running", "done", "error", "blocked", "waiting", "stopped"] as ChildStatus[]}>
          {(status) => (
            <text
              fg={vm.statusFilters().has(status) ? props.theme.accent : props.theme.textMuted}
              selectable={false}
              onMouseDown={() => vm.toggleStatusFilter(status)}
            >[{status}]</text>
          )}
        </For>
        <text fg={props.theme.textMuted}> </text>
        <text
          fg={props.focusMode() ? props.theme.accent : props.theme.textMuted}
          selectable={false}
          onMouseDown={props.onToggleFocusMode}
        >[focus]</text>
      </box>
      <AggregateBar counts={counts} theme={props.theme} />
      <ActionBar
        theme={props.theme}
        hasSelection={() => vm.selectedIds().size > 0}
        onBlock={vm.blockSelected}
        onStop={vm.stopSelected}
        onClear={vm.clearControls}
        onClearSelection={vm.clearSelection}
      />

      <Show when={props.expanded()}>
        <box flexDirection="column">
          <Show when={props.focusMode() && vm.focusedId()}>
            <DetailPanel
              detail={vm.focusedDetail}
              theme={props.theme}
              nowMs={props.nowMs}
            />
          </Show>
          <For each={vm.filteredChildHierarchy()}>
            {(node: HierarchyNode) => (
              <ChildRow
                node={node}
                nowMs={props.nowMs}
                sidebarWidth={props.sidebarWidth}
                theme={props.theme}
                isSelected={vm.selectedIds().has(node.child.id)}
                isFocused={vm.focusedId() === node.child.id}
                onSelect={vm.toggleSelect}
                onFocus={vm.selectOnly}
              />
            )}
          </For>

          <Show when={children().length === 0}>
            <text fg={props.theme.textMuted}>no subagents</text>
          </Show>
        </box>
      </Show>
    </box>
  );
}

function HomeBottomStatus(props: {
  state: Accessor<StatuslineState>;
  theme: TuiThemeCurrent;
}) {
  const counts = createMemo(() => getCounts(props.state()));

  const visible = createMemo(
    () => counts().running > 0 || counts().error > 0 || counts().blocked > 0 || counts().waiting > 0,
  );

  return (
    <Show when={visible()}>
      <box paddingLeft={1} paddingRight={1}>
        <box flexDirection="row">
          <text fg={props.theme.warning}>{`● ${counts().running}`}</text>
          <Show when={counts().blocked > 0}>
            <text fg={props.theme.textMuted}> · </text>
            <text fg={props.theme.info ?? props.theme.text}>{`⊘ ${counts().blocked}`}</text>
          </Show>
          <Show when={counts().waiting > 0}>
            <text fg={props.theme.textMuted}> · </text>
            <text fg={props.theme.warning}>{`◔ ${counts().waiting}`}</text>
          </Show>
          <text fg={props.theme.textMuted}> · </text>
          <text fg={props.theme.success}>{`✓ ${counts().done}`}</text>
          <Show when={counts().error > 0}>
            <text fg={props.theme.textMuted}> · </text>
            <text fg={props.theme.error}>{`✕ ${counts().error}`}</text>
          </Show>
          <Show when={counts().stopped > 0}>
            <text fg={props.theme.textMuted}> · </text>
            <text fg={props.theme.error}>{`■ ${counts().stopped}`}</text>
          </Show>
        </box>
      </box>
    </Show>
  );
}

// Helper imports for SidebarSubagents
function collapseToolWrappers(children: ChildSessionState[]): ChildSessionState[] {
  const realChildren = children.filter((child) => child.source !== "tool");
  return children.filter((child) => {
    if (child.source !== "tool") return true;
    if (
      child.source === "tool" &&
      realChildren.some((real) => real.parentID === child.parentID)
    ) {
      return false;
    }
    return !realChildren.some(
      (real) =>
        real.parentID === child.parentID &&
        real.title.toLowerCase().includes(child.title.toLowerCase()),
    );
  });
}

function byPriority(a: ChildSessionState, b: ChildSessionState): number {
  const rank = (status: ChildSessionState["status"]): number => {
    switch (status) {
      case "running": return 0;
      case "blocked": return 1;
      case "waiting": return 2;
      case "error": return 3;
      case "stopped": return 4;
      case "done": return 5;
      default: return 6;
    }
  };
  const diff = rank(a.status) - rank(b.status);
  if (diff !== 0) return diff;
  return b.updatedAt.localeCompare(a.updatedAt);
}

function getCounts(state: StatuslineState): StatusCounts {
  const counts: StatusCounts = { running: 0, done: 0, error: 0, blocked: 0, waiting: 0, stopped: 0 };
  for (const child of Object.values(state.children)) {
    switch (child.status) {
      case "running": counts.running += 1; break;
      case "done": counts.done += 1; break;
      case "error": counts.error += 1; break;
      case "blocked": counts.blocked += 1; break;
      case "waiting": counts.waiting += 1; break;
      case "stopped": counts.stopped += 1; break;
    }
  }
  return counts;
}

interface HierarchyNode {
  child: ChildSessionState;
  depth: number;
  isOrphan: boolean;
  hasChildren: boolean;
}

function buildHierarchy(children: ChildSessionState[], sessionID: string): HierarchyNode[] {
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
      const hasChildren = childMap.has(child.id);
      result.push({ child, depth, isOrphan: false, hasChildren });
      if (hasChildren) traverse(child.id, depth + 1);
    }
  }

  const direct = childMap.get(sessionID) ?? [];
  const directSorted = [...direct].sort(byPriority);
  for (const child of directSorted) {
    const hasChildren = childMap.has(child.id);
    result.push({ child, depth: 0, isOrphan: false, hasChildren });
    if (hasChildren) traverse(child.id, 1);
  }

  const knownIds = new Set(result.map((n) => n.child.id));
  for (const child of children) {
    if (!knownIds.has(child.id) && childMap.has(child.id)) {
      result.push({ child, depth: 1, isOrphan: true, hasChildren: childMap.has(child.id) });
    }
  }

  return result;
}

const tui: TuiPlugin = async (api: TuiPluginApi) => {
  const statePath = api.state.path.directory
    ? `${api.state.path.directory}/subagent-status/state.json`
    : `${process.env.XDG_RUNTIME_DIR ?? "/tmp"}/cobies-opencode-statusline/pid-${process.pid}/state.json`;
  const textPath = statePath.replace("state.json", "status.txt");

  const [state, setState] = createSignal<StatuslineState>({
    children: {},
    updatedAt: new Date().toISOString(),
  });
  const [nowMs, setNowMs] = createSignal(Date.now());
  const [subagentsExpanded, setSubagentsExpanded] = createSignal(
    api.kv.get<boolean>(SUBAGENTS_EXPANDED_KV_KEY, true) !== false,
  );
  const [subagentsSectionEnabled, setSubagentsSectionEnabled] = createSignal(
    api.kv.get<boolean>(SUBAGENTS_SECTION_ENABLED_KV_KEY, true) !== false,
  );
  const [focusMode, setFocusMode] = createSignal(
    api.kv.get<boolean>(FOCUS_MODE_KEY, false) !== false,
  );

  const ALL_STATUSES: ChildStatus[] = ["running", "done", "error", "blocked", "waiting", "stopped"];
  const defaultFilters = new Set<ChildStatus>(ALL_STATUSES);
  const storedFilters = api.kv.get<ChildStatus[]>(STATUS_FILTERS_KEY);
  if (storedFilters && Array.isArray(storedFilters)) {
    defaultFilters.clear();
    for (const s of storedFilters) {
      if (ALL_STATUSES.includes(s)) defaultFilters.add(s);
    }
  }
  const [statusFilters, setStatusFilters] = createSignal<Set<ChildStatus>>(defaultFilters);
  let disposed = false;

  const setSubagentsExpandedPreference = (expanded: boolean): void => {
    setSubagentsExpanded(expanded);
    api.kv.set(SUBAGENTS_EXPANDED_KV_KEY, expanded);
  };

  const setSubagentsSectionEnabledPreference = (enabled: boolean): void => {
    setSubagentsSectionEnabled(enabled);
    api.kv.set(SUBAGENTS_SECTION_ENABLED_KV_KEY, enabled);
  };

  const setFocusModePreference = (enabled: boolean): void => {
    setFocusMode(enabled);
    api.kv.set(FOCUS_MODE_KEY, enabled);
  };

  const setStatusFiltersPreference = (filters: Set<ChildStatus>): void => {
    setStatusFilters(filters);
    api.kv.set(STATUS_FILTERS_KEY, [...filters]);
  };

  const commandDispose = api.command.register(() => [
    {
      title: subagentsSectionEnabled()
        ? "Subagents: Disable sidebar section"
        : "Subagents: Enable sidebar section",
      value: "subagent-statusline.toggle-sidebar-section",
      description: "Toggle the entire subagent sidebar section",
      category: "Subagents",
      onSelect: () => setSubagentsSectionEnabledPreference(!subagentsSectionEnabled()),
    },
    {
      title: subagentsExpanded()
        ? "Subagents: Collapse list"
        : "Subagents: Expand list",
      value: "subagent-statusline.toggle-expanded",
      description: "Expand or collapse the subagent list",
      category: "Subagents",
      onSelect: () => setSubagentsExpandedPreference(!subagentsExpanded()),
    },
    {
      title: focusMode()
        ? "Subagents: Disable focus mode"
        : "Subagents: Enable focus mode",
      value: "subagent-statusline.toggle-focus-mode",
      description: "Show detail panel for focused subagent",
      category: "Subagents",
      onSelect: () => setFocusModePreference(!focusMode()),
    },
  ]);

  // Hydrate previous sessions on mount
  createEffect(() => {
    const route = api.route.current;
    const routeSessionID =
      route.name === "session" && typeof route.params?.sessionID === "string"
        ? route.params.sessionID
        : undefined;

    if (!routeSessionID || disposed) return;

    void (async () => {
      await hydratePreviousSubagents(
        api,
        routeSessionID,
        statePath,
        textPath,
        setState,
      );
    })();
  });

  // Elapsed time ticker
  const tick = setInterval(() => {
    setNowMs(Date.now());
    setState((current: StatuslineState) => {
      const next = cloneState(current);
      if (!hydrateTokensFromTuiState(api, next)) return current;
      persistStateSnapshot(statePath, textPath, next);
      return next;
    });
  }, ELAPSED_TICK_MS);

  const applyEvent = (event: unknown): void => {
    const mapped = mapOpenCodeEventToSubagentEvent(event);
    if (!mapped) return;

    setState((current: StatuslineState) => {
      const next = cloneState(current);
      const changed = processSubagentEvent(next, mapped);
      const hydrated = hydrateTokensFromTuiState(api, next);
      if (!changed && !hydrated) return current;
      persistStateSnapshot(statePath, textPath, next);
      return next;
    });
  };

  const disposers = [
    api.event.on("session.created", applyEvent),
    api.event.on("session.updated", applyEvent),
    api.event.on("session.idle", applyEvent),
    api.event.on("session.error", applyEvent),
    api.event.on("message.updated", applyEvent),
    api.event.on("message.part.updated", applyEvent),
  ];

  api.lifecycle.onDispose(() => {
    disposed = true;
    clearInterval(tick);
    commandDispose();
    for (const dispose of disposers) dispose();
  });

  api.slots.register({
    slots: {
      sidebar_content(ctx: SidebarContentContext) {
        const routeSessionID =
          api.route.current.name === "session" &&
          typeof api.route.current.params?.sessionID === "string"
            ? api.route.current.params.sessionID
            : undefined;
        const sessionID = ctx.session_id ?? routeSessionID ?? "";

        return (
          <Show when={subagentsSectionEnabled()}>
            <SidebarSubagents
              sessionID={sessionID}
              state={state}
              nowMs={nowMs}
              expanded={subagentsExpanded}
              onToggleExpanded={() => setSubagentsExpandedPreference(!subagentsExpanded())}
              sidebarWidth={() => resolveSidebarWidth(ctx)}
              theme={ctx.theme.current}
              focusMode={focusMode}
              onToggleFocusMode={() => setFocusModePreference(!focusMode())}
              statusFilters={statusFilters}
              onStatusFiltersChange={setStatusFiltersPreference}
            />
          </Show>
        );
      },
      home_bottom(ctx: HomeBottomContext) {
        return <HomeBottomStatus state={state} theme={ctx.theme.current} />;
      },
    },
  });
};

function resolveSidebarWidth(ctx: unknown): number | undefined {
  const source = ctx as Record<string, unknown> | undefined;
  if (!source) return undefined;

  const direct =
    toFinitePositiveInt(source.width) ??
    toFinitePositiveInt(source.columns) ??
    toFinitePositiveInt(source.cols);
  if (direct) return direct;

  const size = source.size as Record<string, unknown> | undefined;
  const viewport = source.viewport as Record<string, unknown> | undefined;
  const bounds = source.bounds as Record<string, unknown> | undefined;

  return (
    toFinitePositiveInt(size?.width) ??
    toFinitePositiveInt(viewport?.width) ??
    toFinitePositiveInt(bounds?.width)
  );
}

function toFinitePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : undefined;
}

const plugin: TuiPluginModule = {
  id: TUI_PLUGIN_ID,
  tui,
};

export default plugin;
