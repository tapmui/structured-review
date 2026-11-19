// Runs one scripts/security/*.sh script under bash. On Windows the first `bash`
// on PATH is often WSL's (System32\bash.exe), which would run the script inside
// a Linux distribution that lacks this checkout's Node and Python setup. Git for
// Windows' bash runs it natively against the Windows scanner builds instead.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const gitExecPath = () => execFileSync("git", ["--exec-path"], { encoding: "utf8", windowsHide: true }).trim();

/** SREV_BASH when set; on win32 Git for Windows' bash; elsewhere `bash`. */
export function bashCommand({
  platform = process.platform,
  env = process.env,
  execPath = gitExecPath,
  exists = existsSync,
} = {}) {
  if (env.SREV_BASH) return env.SREV_BASH;
  if (platform !== "win32") return "bash";
  // `git --exec-path` is <Git>/mingw64/libexec/git-core; bash is <Git>/bin/bash.exe.
  const candidate = join(execPath(), "..", "..", "..", "bin", "bash.exe");
  if (exists(candidate)) return candidate;
  throw new Error(`Git for Windows bash not found at ${candidate}; install Git for Windows or set SREV_BASH`);
}

export function securityMain({
  args,
  scriptDir = import.meta.dirname,
  bash = bashCommand,
  spawn = spawnSync,
  error = console.error,
}) {
  const [script, ...rest] = args;
  if (!script || !/^[\w-]+\.sh$/.test(script)) {
    error("usage: node scripts/security/run.mjs <script>.sh [args...]");
    return 2;
  }
  let shell;
  try {
    shell = bash();
  } catch (failure) {
    error(`security: ${failure.message}`);
    return 2;
  }
  const result = spawn(shell, [join(scriptDir, script), ...rest], { stdio: "inherit", windowsHide: true });
  if (result.error) {
    error(`security: cannot run ${shell}: ${result.error.message}`);
    return 2;
  }
  return result.status ?? 2;
}

export function securityCli({ metaUrl = import.meta.url, argv = process.argv, main = securityMain } = {}) {
  if (!argv[1] || metaUrl !== pathToFileURL(resolve(argv[1])).href) return undefined;
  const code = main({ args: argv.slice(2) });
  process.exitCode = code;
  return code;
}

securityCli();
