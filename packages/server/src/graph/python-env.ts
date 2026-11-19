// Python environment description for scip-python's --environment option.
// Without it, scip-python runs `pip3 list` / `pip list` itself. That fails
// where the pip launcher cannot run, for example when Windows Application
// Control blocks Scripts\pip3.exe. Asking the interpreter directly through
// importlib.metadata needs no pip executable and gives the same data.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Mirrors scip-python's own get_packages.py: only .py/.pyi files inside the
// distribution. The first distribution with a name wins, as it does on import.
const LIST_DISTRIBUTIONS = `
import importlib.metadata, json, sys
seen, out = set(), []
for dist in importlib.metadata.distributions():
    name = dist.metadata["Name"]
    if not name or name in seen:
        continue
    seen.add(name)
    files = [str(f) for f in (dist.files or [])]
    files = [f for f in files if f.endswith((".py", ".pyi")) and not f.startswith("..") and "__pycache__" not in f]
    out.append({"name": name, "version": dist.version, "files": files})
json.dump(out, sys.stdout)
`;

export type RunPython = (argv0: string, args: string[]) => string;

const runPython: RunPython = (argv0, args) =>
  execFileSync(argv0, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true });

/** Interpreters to try, in order. SCIP_PYTHON overrides the search. */
export function pythonCandidates(platform = process.platform, override = process.env.SCIP_PYTHON): string[] {
  if (override) return [override];
  // On Windows, python3 is often the Microsoft Store stub, so try python first.
  return platform === "win32" ? ["python", "python3"] : ["python3", "python"];
}

/** scip-python arguments for dir: --environment <file>, or none when no
 *  interpreter answers and scip-python must fall back to its own pip lookup. */
export function pythonEnvironmentArgs(dir: string, write = writePythonEnvironment): string[] {
  const file = write(dir);
  return file ? ["--environment", file] : [];
}

/**
 * Write the environment JSON into dir and return its path, or undefined when
 * no interpreter answers.
 */
export function writePythonEnvironment(
  dir: string,
  run: RunPython = runPython,
  candidates = pythonCandidates(),
): string | undefined {
  for (const python of candidates) {
    let stdout: string;
    try {
      stdout = run(python, ["-c", LIST_DISTRIBUTIONS]);
      if (!Array.isArray(JSON.parse(stdout))) continue;
    } catch {
      continue;
    }
    const file = join(dir, "python-environment.json");
    writeFileSync(file, stdout);
    return file;
  }
  return undefined;
}
