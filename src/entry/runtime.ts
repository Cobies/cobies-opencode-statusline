// Composition — Runtime plugin

import type { Plugin } from "@opencode-ai/plugin";
import { fileStateRepository, resolveStatePath, resolveTextPath, shouldPreserveStateOnStartup, createEmptyState } from "../adapters/persistence/file-state-repository.js";
import { fileStatusOutput } from "../adapters/presentation/statusline/text-status-output.js";
import { mapOpenCodeEventToSubagentEvent } from "../adapters/opencode/opencode-event-mapper.js";
import { processSubagentEvent } from "../application/use-cases/process-subagent-event.js";
import { renderStatusLine } from "../application/use-cases/build-statusline-summary.js";

export const SubagentStatusline: Plugin = async () => {
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
      // Defensive by design: initialization failure should not crash OpenCode startup.
    }
  }

  return {
    event: async ({ event }: { event?: unknown }) => {
      try {
        const state = await repo.load();
        const mapped = mapOpenCodeEventToSubagentEvent(event);
        if (!mapped) return;

        const changed = processSubagentEvent(state, mapped);
        if (!changed) return;

        await repo.save(state);
        await output.write(renderStatusLine(state));
      } catch {
        // Defensive by design: plugin should never crash OpenCode on bad event shape.
      }
    },
  };
};