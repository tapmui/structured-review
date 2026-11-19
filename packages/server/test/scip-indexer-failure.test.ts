// How a failing or missing indexer surfaces, independent of which toolchains
// the machine has: the external commands come from the provider's seams.
import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IndexError, ScipGraphProvider } from "../src/graph/scip.js";
import type { IndexerJob } from "../src/graph/roots.js";
import type { ToolCommand } from "../src/graph/toolchain.js";

class Probe extends ScipGraphProvider {
  java: ToolCommand | null = null;
  dotnet: ToolCommand | null = null;
  protected override resolveJavaCommand(): ToolCommand | null {
    return this.java;
  }
  protected override resolveDotnetCommand(): ToolCommand | null {
    return this.dotnet;
  }
  run(job: IndexerJob) {
    return this.runIndexer(job);
  }
}

let repo: string;
afterEach(() => rmSync(repo, { recursive: true, force: true }));
function probe(): Probe {
  repo = mkdtempSync(join(tmpdir(), "srev-indexer-failure-"));
  mkdirSync(join(repo, "svc"));
  return new Probe({ repoRoot: repo });
}

describe("indexer failures", () => {
  it("wraps a crashing indexer in an IndexError carrying the tail of its stderr", async () => {
    const p = probe();
    p.java = { argv0: process.execPath, args: ["-e", "process.stderr.write('indexer exploded'); process.exit(3)"] };
    const failure = p.run({ language: "java", root: "svc", hasSources: true });
    await expect(failure).rejects.toBeInstanceOf(IndexError);
    await expect(failure).rejects.toThrow(/java indexer failed for root 'svc': [\s\S]*indexer exploded/);
  });

  it("reports a missing scip-java or scip-dotnet toolchain as an IndexError", async () => {
    const p = probe();
    await expect(p.run({ language: "java", root: "svc", hasSources: true })).rejects.toThrow(
      /scip-java toolchain not found for root 'svc'/,
    );
    await expect(p.run({ language: "cs", root: "", hasSources: true })).rejects.toThrow(
      /scip-dotnet not found for root '\.'/,
    );
  });
});
