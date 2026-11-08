import { it, expect } from "vitest";
import { mkdtemp, cp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
it("blocks early, late and malformed deploys and rechecks after pulling before replacement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sever-deploy-"));
  try {
    await mkdir(join(dir, "scripts"));
    await mkdir(join(dir, "bin"));
    for (const file of [
      "deploy.sh",
      "check-deploy-time.sh",
      "run-scheduled-deploy.sh",
    ])
      await cp(`scripts/${file}`, join(dir, "scripts", file));
    const log = join(dir, "docker.log"),
      clock = join(dir, "after-pull");
    await writeFile(
      join(dir, "bin", "date"),
      `#!/usr/bin/env bash
if [[ "$*" == *'-d '* ]]; then echo 1000; elif [[ -f "$CLOCK_FILE" ]]; then echo 1700; else echo "\${NOW_SECONDS:-1000}"; fi
`,
      { mode: 0o755 },
    );
    await writeFile(
      join(dir, "bin", "docker"),
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [[ "$*" == *'pull app'* && "\${DELAY_PULL:-}" == yes ]]; then touch "$CLOCK_FILE"; fi
if [[ "$*" == *'up -d'* && "\${FAIL_UP:-}" == yes ]]; then exit 1; fi
if [[ "$*" == *'deployment-queue.ts claim'* ]]; then printf '%s' "\${QUEUE_ENTRY:-}"; fi
`,
      { mode: 0o755 },
    );
    await writeFile(
      join(dir, "bin", "flock"),
      "#!/usr/bin/env bash\nexit 0\n",
      { mode: 0o755 },
    );
    const env = {
      ...process.env,
      PATH: join(dir, "bin") + ":" + process.env.PATH,
      DOCKER_LOG: log,
      CLOCK_FILE: clock,
      DEPLOY_LOCK_FILE: join(dir, "lock"),
      DEPLOY_QUEUE_LOCK_FILE: join(dir, "queue-lock"),
    };
    const run = (
      version = "1.2.3",
      time = "2026-12-01T00:00:00Z",
      extra = {},
    ) =>
      spawnSync("bash", [join(dir, "scripts/deploy.sh"), version, time], {
        env: { ...env, ...extra },
        encoding: "utf8",
      });
    expect(run("bad").status).toBe(2);
    expect(run("1.2.3", "bad").status).toBe(2);
    expect(run("1.2.3", undefined, { NOW_SECONDS: "999" }).status).toBe(3);
    expect(run("1.2.3", undefined, { NOW_SECONDS: "1601" }).status).toBe(3);
    expect(run().status).toBe(0);
    expect(await readFile(log, "utf8")).toContain(
      "up -d --wait --wait-timeout 120",
    );
    await writeFile(log, "");
    expect(run("1.2.3", undefined, { DELAY_PULL: "yes" }).status).toBe(3);
    expect(await readFile(log, "utf8")).not.toContain("up -d");
    await rm(clock);
    const runner = (extra = {}) =>
      spawnSync("bash", [join(dir, "scripts/run-scheduled-deploy.sh")], {
        env: { ...env, ...extra },
        encoding: "utf8",
      });
    expect(runner().status).toBe(0);
    const entry = "job-id\t1.2.3\t2026-12-01T00:00:00Z";
    expect(runner({ QUEUE_ENTRY: entry }).status).toBe(0);
    expect(await readFile(log, "utf8")).toContain("finish job-id succeeded");
    expect(runner({ QUEUE_ENTRY: entry, FAIL_UP: "yes" }).status).toBe(1);
    expect(await readFile(log, "utf8")).toContain("finish job-id failed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 15000);
