import { solidPlugin } from "esbuild-plugin-solid";
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      runtime: "src/entry/runtime.ts",
    },
    format: "esm",
    target: "node22",
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    bundle: false,
    outDir: "dist",
    external: [
      "@opencode-ai/plugin",
      "@opentui/core",
      "solid-js",
    ],
  },
  {
    entry: {
      tui: "src/entry/tui.tsx",
    },
    format: "esm",
    target: "node22",
    splitting: false,
    sourcemap: true,
    clean: false,
    dts: {
      entry: {
        tui: "src/entry/tui.tsx",
      },
    },
    bundle: true,
    outDir: "dist",
    external: [
      "@opencode-ai/plugin",
      "@opencode-ai/plugin/tui",
      "@opentui/core",
      "@opentui/solid",
      "solid-js",
    ],
    esbuildPlugins: [
      solidPlugin({ solid: { generate: "universal", moduleName: "@opentui/solid" } }),
    ],
  },
]);