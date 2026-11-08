import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
it("verifies remote annotated tags despite a peeled local checkout and rejects tags outside main", () => {
  const dir = mkdtempSync(join(tmpdir(), "sever-release-"));
  const origin = join(dir, "origin.git"),
    seed = join(dir, "seed"),
    checkout = join(dir, "checkout");
  const git = (cwd: string, args: string[]) => {
    const result = spawnSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        ...args,
      ],
      { cwd, encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  try {
    git(dir, ["init", "--bare", "--initial-branch=main", origin]);
    git(dir, ["init", "--initial-branch=main", seed]);
    writeFileSync(join(seed, "readme"), "main");
    git(seed, ["add", "."]);
    git(seed, ["commit", "-m", "Main version"]);
    git(seed, ["tag", "-a", "1.2.3", "-m", "Release"]);
    git(seed, ["remote", "add", "origin", origin]);
    git(seed, ["push", "origin", "main", "--tags"]);
    git(dir, ["clone", origin, checkout]);
    const commit = git(checkout, ["rev-parse", "HEAD"]);
    git(checkout, ["tag", "-d", "1.2.3"]);
    git(checkout, ["tag", "1.2.3", commit]);
    const run = (version: string) =>
      spawnSync("bash", [resolve("scripts/verify-release.sh"), version], {
        cwd: checkout,
        encoding: "utf8",
      });
    expect(run("1.2.3").status).toBe(0);
    expect(git(checkout, ["rev-parse", "refs/tags/1.2.3"])).toBe(commit);
    expect(
      git(checkout, ["rev-parse", "refs/release-tags/1.2.3^{commit}"]),
    ).toBe(commit);
    expect(run("1.2.3").status).toBe(0);
    git(seed, ["switch", "-c", "feature"]);
    writeFileSync(join(seed, "readme"), "unmerged");
    git(seed, ["add", "."]);
    git(seed, ["commit", "-m", "Unmerged"]);
    git(seed, ["tag", "-a", "1.2.4", "-m", "Not released"]);
    git(seed, ["push", "origin", "1.2.4"]);
    expect(run("1.2.4").status).not.toBe(0);
    expect(run("missing").status).toBe(2);
    expect(run("9.9.9").status).not.toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
