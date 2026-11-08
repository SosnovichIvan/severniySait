import { it, expect } from "vitest";
import { Store } from "../server/repository/store";
import { deploymentCommand } from "../server/domain/deployment-queue";
it("claims atomically at the selected time, expires missed jobs and records outcomes", () => {
  const store = new Store(":memory:");
  try {
    const now = "2026-12-01T00:00:00.000Z";
    const id = store.scheduleDeployment("1.0.0", now, now)!;
    expect(
      deploymentCommand(store, ["claim"], "2026-11-30T23:59:59.000Z"),
    ).toBe("");
    expect(deploymentCommand(store, ["claim"], now)).toBe(
      `${id}\t1.0.0\t${now}`,
    );
    expect(store.cancelDeployment(id)).toBe(0);
    expect(deploymentCommand(store, ["claim"], now)).toBe("");
    expect(() => deploymentCommand(store, ["bad"])).toThrow("Используйте");
    expect(() =>
      deploymentCommand(store, ["finish", id, "scheduled"]),
    ).toThrow();
    deploymentCommand(store, ["finish", id, "succeeded"]);
    expect(store.deployments()[0]).toMatchObject({
      status: "succeeded",
      detail: expect.stringContaining("готовности"),
    });
    expect(() => deploymentCommand(store, ["finish", id, "failed"])).toThrow(
      "не выполняется",
    );
    store.scheduleDeployment("1.0.1", now, now);
    expect(
      deploymentCommand(store, ["claim"], "2026-12-01T00:10:01.000Z"),
    ).toBe("");
    expect(store.deployments()[0]).toMatchObject({
      status: "failed",
      detail: expect.stringContaining("пропущено"),
    });
    const failed = store.scheduleDeployment("1.0.2", now, now)!;
    deploymentCommand(store, ["claim"], now);
    deploymentCommand(store, ["finish", failed, "failed"]);
    expect(store.deployments()[0].status).toBe("failed");
    store.scheduleDeployment("1.0.3", now, now);
    deploymentCommand(store, ["claim"], now);
    deploymentCommand(store, ["recover"]);
    expect(store.deployments()[0]).toMatchObject({
      status: "failed",
      detail: expect.stringContaining("прервался"),
    });
    expect(store.db.pragma("integrity_check", { simple: true })).toBe("ok");
  } finally {
    store.close();
  }
});
