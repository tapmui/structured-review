// Run an installed package's CLI with this Node, never through a shim.
// node_modules/.bin entries are shell scripts on POSIX and .cmd files on
// Windows, and pnpm itself is pnpm.cmd there; Node can spawn neither without a
// shell. The JS entry named in the package's "bin" field runs the same everywhere.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** [node, entry] for `pkg`'s `bin` CLI, resolved as require() would from `from`. */
export function nodeBin(pkg, bin = pkg.split("/").pop(), from = process.cwd()) {
  const searchPaths = createRequire(join(from, "package.json")).resolve.paths(pkg) ?? [];
  for (const nodeModules of searchPaths) {
    const manifestPath = join(nodeModules, pkg, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[bin];
    if (!entry) throw new Error(`${pkg} has no "${bin}" executable`);
    return [process.execPath, join(dirname(manifestPath), entry)];
  }
  throw new Error(`${pkg} is not installed (resolved from ${from})`);
}

/** [node, pnpm entry] when running under pnpm (npm_execpath), else a bare "pnpm". */
export function pnpmCommand(env = process.env) {
  const entry = env.npm_execpath;
  if (entry && /pnpm\.(c?js|mjs)$/.test(entry)) return [process.execPath, entry];
  return ["pnpm"];
}

/** A bare "pnpm" on Windows is pnpm.cmd, which only starts through a shell. */
export function needsShell(file, platform = process.platform) {
  return platform === "win32" && file === "pnpm";
}
