import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { needsShell, nodeBin, pnpmCommand } from "../../scripts/harness/node-bin.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("nodeBin", () => {
  it("resolves a package's JS entry, never a .bin shim", () => {
    for (const [pkg, bin] of [
      ["eslint", "eslint"],
      ["dependency-cruiser", "depcruise"],
      ["knip", "knip"],
    ]) {
      const [node, entry] = nodeBin(pkg, bin, repositoryRoot);
      expect(node).toBe(process.execPath);
      expect(entry).not.toMatch(/[\\/]\.bin[\\/]/);
      expect(existsSync(entry)).toBe(true);
    }
  });

  it("accepts a package whose bin is a single path", () => {
    const root = mkdtempSync(join(tmpdir(), "srev-node-bin-"));
    try {
      mkdirSync(join(root, "node_modules/@scope/tool"), { recursive: true });
      writeFileSync(join(root, "node_modules/@scope/tool/package.json"), '{"bin":"cli.js"}');
      expect(nodeBin("@scope/tool", undefined, root)).toEqual([
        process.execPath,
        join(root, "node_modules/@scope/tool/cli.js"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed for missing packages, builtins and missing executables", () => {
    expect(() => nodeBin("srev-no-such-package", undefined, repositoryRoot)).toThrow(/not installed/);
    expect(() => nodeBin("fs", undefined, repositoryRoot)).toThrow(/not installed/);
    expect(() => nodeBin("eslint", "no-such-bin", repositoryRoot)).toThrow(/no "no-such-bin" executable/);
  });
});

describe("pnpmCommand", () => {
  it("uses pnpm's JS entry when started by pnpm, else the bare command", () => {
    const entry = "C:/corepack/pnpm/10.15.1/bin/pnpm.cjs";
    expect(pnpmCommand({ npm_execpath: entry })).toEqual([process.execPath, entry]);
    expect(pnpmCommand({ npm_execpath: "/usr/lib/node_modules/npm/bin/npm-cli.js" })).toEqual(["pnpm"]);
    expect(pnpmCommand({})).toEqual(["pnpm"]);
  });

  it("needs a shell only for a bare pnpm on Windows", () => {
    expect(needsShell("pnpm", "win32")).toBe(true);
    expect(needsShell(process.execPath, "win32")).toBe(false);
    expect(needsShell("pnpm", "linux")).toBe(false);
  });
});
