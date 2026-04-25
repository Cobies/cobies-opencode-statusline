// Domain — status counts

import type { StatuslineState, StatusCounts } from "../entities/statusline-state.js";

export function getCounts(state: StatuslineState): StatusCounts {
  const counts: StatusCounts = { running: 0, done: 0, error: 0, blocked: 0, waiting: 0, stopped: 0 };
  for (const child of Object.values(state.children)) {
    if (child.status === "running") counts.running += 1;
    else if (child.status === "done") counts.done += 1;
    else if (child.status === "error") counts.error += 1;
    else if (child.status === "blocked") counts.blocked += 1;
    else if (child.status === "waiting") counts.waiting += 1;
    else if (child.status === "stopped") counts.stopped += 1;
  }
  return counts;
}