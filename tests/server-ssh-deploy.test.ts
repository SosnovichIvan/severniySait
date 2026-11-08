import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
it("restricts the deployment key to a version and UTC timestamp without interpreting shell syntax", () => {
  const dir = mkdtempSync(join(tmpdir(), "sever-ssh-"));
  try {
    const output = join(dir, "arguments");
    writeFileSync(
      join(dir, "sudo"),
      '#!/bin/bash\nprintf "%s\\n" "$@" > "$TEST_OUTPUT"\n',
      { mode: 0o700 },
    );
    const run = (command: string) =>
      spawnSync("bash", [resolve("ops/ssh-deploy.sh")], {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          TEST_OUTPUT: output,
          SSH_ORIGINAL_COMMAND: command,
        },
        encoding: "utf8",
      });
    expect(run("deploy 1.2.3 2026-11-08T15:00:00Z").status).toBe(0);
    expect(readFileSync(output, "utf8")).toBe(
      "-n\n/opt/severniySait/scripts/deploy.sh\n1.2.3\n2026-11-08T15:00:00Z\n",
    );
    for (const command of [
      "",
      "bash",
      "deploy 1.2.3 2026-11-08T15:00:00Z; id",
      "deploy ../main now",
      "deploy 01.2.3 2026-11-08T15:00:00Z",
      "scp -t /opt/severniySait",
    ])
      expect(run(command).status).toBe(2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
