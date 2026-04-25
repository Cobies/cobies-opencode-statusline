import { fileStateRepository, resolveStatePath, resolveTextPath, shouldPreserveStateOnStartup, createEmptyState } from "../adapters/persistence/file-state-repository.js";
import { fileStatusOutput } from "../adapters/presentation/statusline/text-status-output.js";
import { mapOpenCodeEventToSubagentEvent } from "../adapters/opencode/opencode-event-mapper.js";
import { processSubagentEvent } from "../application/use-cases/process-subagent-event.js";
import { renderStatusLine } from "../application/use-cases/build-statusline-summary.js";
const SubagentStatusline = async () => {
  const statePath = resolveStatePath();
  const textPath = resolveTextPath(statePath);
  const repo = fileStateRepository(statePath);
  const output = fileStatusOutput(textPath);
  if (!shouldPreserveStateOnStartup()) {
    try {
      const emptyState = createEmptyState();
      await repo.save(emptyState);
      await output.write(renderStatusLine(emptyState));
    } catch {
    }
  }
  return {
    event: async ({ event }) => {
      try {
        const state = await repo.load();
        const mapped = mapOpenCodeEventToSubagentEvent(event);
        if (!mapped) return;
        const changed = processSubagentEvent(state, mapped);
        if (!changed) return;
        await repo.save(state);
        await output.write(renderStatusLine(state));
      } catch {
      }
    }
  };
};
export {
  SubagentStatusline
};
//# sourceMappingURL=runtime.js.map