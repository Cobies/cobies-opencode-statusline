// Adapter — File status output

import { writeFile } from "node:fs/promises";
import type { StatusOutput } from "../../../ports/status-output.js";

export const fileStatusOutput = (textPath: string): StatusOutput => ({
  async write(summary: string): Promise<void> {
    await writeFile(textPath, summary, "utf8");
  },
});