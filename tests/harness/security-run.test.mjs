import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { bashCommand, securityCli, securityMain } from "../../scripts/security/run.mjs";

describe("bashCommand", () => {
  it("prefers SREV_BASH, then plain bash off Windows", () => {
    expect(bashCommand({ platform: "win32", env: { SREV_BASH: "/opt/bash" } })).toBe("/opt/bash");
    expect(bashCommand({ platform: "linux", env: {} })).toBe("bash");
  });

  it("uses Git for Windows' bash on win32, never the WSL bash on PATH", () => {
    const execPath = () => "C:/Program Files/Git/mingw64/libexec/git-core";
    const expected = join("C:/Program Files/Git", "bin", "bash.exe");
    expect(bashCommand({ platform: "win32", env: {}, execPath, exists: (p) => p === expected })).toBe(expected);
    expect(() => bashCommand({ platform: "win32", env: {}, execPath, exists: () => false })).toThrow(
      /Git for Windows bash not found/,
    );
  });

  it("locates the Git installation through git --exec-path", () => {
    expect(bashCommand({ platform: "win32", env: {}, exists: () => true })).toMatch(/[\\/]bin[\\/]bash\.exe$/);
  });
});

describe("securityMain", () => {
  const ok = () => ({ status: 0 });

  it("runs the named script from the security directory with the remaining arguments", () => {
    const spawn = vi.fn(() => ({ status: 1 }));
    const code = securityMain({ args: ["probe.sh", "x"], scriptDir: "/s", bash: () => "B", spawn });
    expect(code).toBe(1);
    expect(spawn).toHaveBeenCalledWith("B", [join("/s", "probe.sh"), "x"], { stdio: "inherit", windowsHide: true });
  });

  it("fails closed on bad script names, a missing bash, spawn errors and signals", () => {
    const error = vi.fn();
    expect(securityMain({ args: [], error, spawn: ok })).toBe(2);
    expect(securityMain({ args: ["../x.sh"], error, spawn: ok })).toBe(2);
    const missing = () => {
      throw new Error("no bash");
    };
    expect(securityMain({ args: ["check.sh"], bash: missing, error, spawn: ok })).toBe(2);
    const enoent = () => ({ error: new Error("ENOENT") });
    expect(securityMain({ args: ["check.sh"], bash: () => "B", error, spawn: enoent })).toBe(2);
    expect(securityMain({ args: ["check.sh"], bash: () => "B", error, spawn: () => ({ status: null }) })).toBe(2);
    expect(error.mock.calls.map(([m]) => m)).toEqual([
      expect.stringMatching(/usage/),
      expect.stringMatching(/usage/),
      "security: no bash",
      "security: cannot run B: ENOENT",
    ]);
  });
});

describe("securityCli", () => {
  it("runs only as the entry script and sets the exit code", () => {
    const main = vi.fn(() => 3);
    const file = "/repo/scripts/security/run.mjs";
    const metaUrl = pathToFileURL(file).href;
    expect(securityCli({ metaUrl, argv: ["node"], main })).toBeUndefined();
    expect(securityCli({ metaUrl, argv: ["node", "/elsewhere.mjs"], main })).toBeUndefined();
    const previous = process.exitCode;
    try {
      expect(securityCli({ metaUrl, argv: ["node", file, "check.sh"], main })).toBe(3);
      expect(main).toHaveBeenCalledWith({ args: ["check.sh"] });
    } finally {
      process.exitCode = previous;
    }
  });
});
