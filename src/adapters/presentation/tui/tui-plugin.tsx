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
  formatChildRowLine,
  formatTokenDetail,
  compactModelName,
  createTuiViewModel,
  buildHierarchy,
  type FormattedChildRow,
  type ChildDetail,
  type HierarchyNode,
} from "./tui-view-model.js";
import type { ChildSessionState, StatuslineState, StatusCounts } from "../../../domain/entities/statusline-state.js";
import { cloneState } from "./tui-clone.js";
import { hydrateTokensFromTuiState } from "./tui-token-hydration.js";
import { hydratePreviousSubagents } from "./tui-hydration.js";
import { persistStateSnapshot } from "./tui-persistence.js";

const TUI_PLUGIN_ID = "subagent-statusline.tui";
const ELAPSED_TICK_MS = 1000;
const SUBAGENTS_EXPANDED_KV_KEY = "subagents.sidebar.expanded";
const SUBAGENTS_SECTION_ENABLED_KV_KEY = "subagents.sidebar.enabled";

type SidebarContentContext = TuiSlotContext & { session_id?: string };
type HomeBottomContext = TuiSlotContext;

const CLOCK_ICON = "";
const TOKEN_ICON = "";
const MODEL_ICON = "";
const SOURCE_ICON = "☁";
const STATUS_ICON = "●";
const ERROR_ICON = "⏍";
const EVENT_ICON = "▸";

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

interface ChildRowProps {
  node: HierarchyNode;
  nowMs: () => number;
  sidebarWidth: () => number | undefined;
  theme: TuiThemeCurrent;
  isFocused: boolean;
  onFocus: (id: string) => void;
  detail?: Accessor<ChildDetail | undefined>;
  onClose?: () => void;
}

function ChildRow(props: ChildRowProps) {
  const line = (): FormattedChildRow =>
    formatChildRowLine(
      props.node.child,
      props.nowMs(),
      props.sidebarWidth(),
      false,
      props.isFocused,
    );

  const depth = () => props.node.depth;
  const indent = () => (depth() > 0 ? "  ".repeat(depth()) : "");
  const detail = (): ChildDetail | undefined => props.detail?.();

  return (
    <box flexDirection="column">
      <box
        flexDirection="row"
        onMouseDown={() => props.onFocus(props.node.child.id)}
      >
        <text fg={props.theme.textMuted}>{indent()}</text>
        <text fg={statusColor(line().status, props.theme, line().uiControl)}>
          {statusIcon(line().status, line().uiControl)}
        </text>
        <Show when={props.isFocused}>
          <text fg={props.theme.accent} selectable={false}>▶</text>
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

      {/* Inline focused detail — appears directly below the focused row */}
      <Show when={props.isFocused && detail()}>
        {(d: Accessor<ChildDetail>) => (
          <InlineDetailRow
            detail={d()}
            theme={props.theme}
            depth={depth()}
            onClose={props.onClose}
          />
        )}
      </Show>
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

function SidebarSubagents(props: {
  sessionID: string;
  state: Accessor<StatuslineState>;
  nowMs: Accessor<number>;
  expanded: Accessor<boolean>;
  onToggleExpanded: () => void;
  sidebarWidth: Accessor<number | undefined>;
  theme: TuiThemeCurrent;
  focusedId: Accessor<string | undefined>;
  selectOnly: (id: string) => void;
  clearSelection: () => void;
  focusedDetail: () => ChildDetail | undefined;
}) {
  const counts = createMemo(() => {
    const c = getCounts(props.state());
    return c;
  });

  const children = (): ChildSessionState[] => {
    return Object.values(props.state().children).sort(byPriority);
  };

  const hierarchy = (): HierarchyNode[] => {
    return buildHierarchy(children(), props.sessionID);
  };

  const handleFocus = (id: string): void => {
    if (props.focusedId() === id) {
      props.clearSelection();
    } else {
      props.selectOnly(id);
    }
  };

  return (
    <box flexDirection="column">
      <box flexDirection="row">
        <text
          fg={props.theme.text}
          selectable={false}
          onMouseDown={props.onToggleExpanded}
        >{`${props.expanded() ? "▾" : "▸"} Subagents`}</text>
      </box>
      <AggregateBar counts={counts} theme={props.theme} />

      <Show when={props.expanded()}>
        <box flexDirection="column">
          <For each={hierarchy()}>
            {(node: HierarchyNode) => (
              <ChildRow
                node={node}
                nowMs={props.nowMs}
                sidebarWidth={props.sidebarWidth}
                theme={props.theme}
                isFocused={props.focusedId() === node.child.id}
                onFocus={handleFocus}
                detail={props.focusedDetail}
                onClose={props.clearSelection}
              />
            )}
          </For>

          <Show when={hierarchy().length === 0}>
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

interface InlineDetailRowProps {
  detail: ChildDetail;
  theme: TuiThemeCurrent;
  depth: number;
  onClose?: () => void;
}

/** Compact inline detail rendered directly below the focused row */
function InlineDetailRow(props: InlineDetailRowProps) {
  const d = () => props.detail;
  const indent = () => "  ".repeat(props.depth + 1);

  return (
    <box flexDirection="column" paddingLeft={2 + props.depth * 2}>
      <box flexDirection="row">
        <text fg={props.theme.textMuted} selectable={false}>{indent()}{STATUS_ICON} </text>
        <text fg={props.theme.text} selectable={false}>{d().status}</text>
        <text fg={props.theme.textMuted} selectable={false}> · </text>
        <text fg={props.theme.textMuted} selectable={false}>{SOURCE_ICON} {d().source}</text>
        {d().model && (
          <>
            <text fg={props.theme.textMuted} selectable={false}> · </text>
            <text fg={props.theme.accent} selectable={false}>{MODEL_ICON} {compactModelName(d().model)}</text>
          </>
        )}
        {d().tokens && (
          <>
            <text fg={props.theme.textMuted} selectable={false}> · </text>
            <text fg={props.theme.textMuted} selectable={false}>{TOKEN_ICON} {formatTokenDetail(d().tokens)}</text>
          </>
        )}
        <text fg={props.theme.textMuted} selectable={false}> · </text>
        <text fg={props.theme.textMuted} selectable={false}>{CLOCK_ICON} {d().elapsed}</text>
        {d().errorDetail && (
          <>
            <text fg={props.theme.textMuted} selectable={false}> · </text>
            <text fg={props.theme.error} selectable={false}>{ERROR_ICON} {d().errorDetail}</text>
          </>
        )}
        {d().lastEvent && (
          <>
            <text fg={props.theme.textMuted} selectable={false}> · </text>
            <text fg={props.theme.textMuted} selectable={false}>{EVENT_ICON} {d().lastEvent?.type}</text>
          </>
        )}
        <Show when={props.onClose}>
          <text fg={props.theme.textMuted} selectable={false} onMouseDown={props.onClose}> · ✕</text>
        </Show>
      </box>
    </box>
  );
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
  let disposed = false;

  const setSubagentsExpandedPreference = (expanded: boolean): void => {
    setSubagentsExpanded(expanded);
    api.kv.set(SUBAGENTS_EXPANDED_KV_KEY, expanded);
  };

  const setSubagentsSectionEnabledPreference = (enabled: boolean): void => {
    setSubagentsSectionEnabled(enabled);
    api.kv.set(SUBAGENTS_SECTION_ENABLED_KV_KEY, enabled);
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

  // View model for focus/detail UX — re-created when subagentsSectionEnabled toggles
  const vm = createTuiViewModel(state, nowMs, true);

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
              focusedId={vm.focusedId}
              selectOnly={vm.selectOnly}
              clearSelection={vm.clearSelection}
              focusedDetail={vm.focusedDetail}
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
