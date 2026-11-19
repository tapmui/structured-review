import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pythonCandidates, pythonEnvironmentArgs, writePythonEnvironment } from "../src/graph/python-env.js";

describe("pythonEnvironmentArgs", () => {
  it("passes --environment only when an environment file was written", () => {
    expect(pythonEnvironmentArgs("/tmp/x", () => "/tmp/x/python-environment.json")).toEqual([
      "--environment",
      "/tmp/x/python-environment.json",
    ]);
    expect(pythonEnvironmentArgs("/tmp/x", () => undefined)).toEqual([]);
  });
});

describe("pythonCandidates", () => {
  it("prefers python on Windows, python3 elsewhere, and honours SCIP_PYTHON", () => {
    expect(pythonCandidates("win32", undefined)).toEqual(["python", "python3"]);
    expect(pythonCandidates("linux", undefined)).toEqual(["python3", "python"]);
    expect(pythonCandidates("win32", "C:/py/python.exe")).toEqual(["C:/py/python.exe"]);
  });
});

describe("writePythonEnvironment", () => {
  it("writes the first interpreter's JSON and skips interpreters that fail or print garbage", () => {
    const dir = mkdtempSync(join(tmpdir(), "srev-pyenv-"));
    try {
      const tried: string[] = [];
      const env = '[{"name":"requests","version":"2.0","files":["requests/api.py"]}]';
      const file = writePythonEnvironment(
        dir,
        (argv0, args) => {
          tried.push(argv0);
          expect(args[0]).toBe("-c");
          if (argv0 === "missing") throw new Error("ENOENT");
          return argv0 === "garbage" ? "{}" : env;
        },
        ["missing", "garbage", "python"],
      );
      expect(tried).toEqual(["missing", "garbage", "python"]);
      expect(file).toBe(join(dir, "python-environment.json"));
      expect(readFileSync(file!, "utf8")).toBe(env);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns undefined when no interpreter answers", () => {
    const dir = mkdtempSync(join(tmpdir(), "srev-pyenv-"));
    try {
      const fail = () => {
        throw new Error("ENOENT");
      };
      expect(writePythonEnvironment(dir, fail, ["python3", "python"])).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
