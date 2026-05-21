import { chmod } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  banner: {
    js: "#!/usr/bin/env node"
  },
  external: ["ink", "react", "react/jsx-runtime", "ink-text-input", "ink-spinner"],
  sourcemap: true
});

await chmod("dist/index.js", 0o755);
