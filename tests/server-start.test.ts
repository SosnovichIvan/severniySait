import { it, expect, vi, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  listen: vi.fn(),
  create: vi.fn(),
  store: vi.fn(),
  storeClose: vi.fn(),
}));
vi.mock("../server/repository/store", () => ({
  Store: class {
    constructor(path: string) {
      mocks.store(path);
    }
    close() {
      mocks.storeClose();
    }
  },
}));
vi.mock("../server/transport/app", () => ({
  createApp: (options: unknown) => {
    mocks.create(options);
    return {
      listen: (port: number, host: string, callback: () => void) => {
        mocks.listen(port, host);
        callback();
        return {
          close: (callback: () => void) => {
            mocks.close();
            callback();
          },
        };
      },
    };
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetModules();
  vi.clearAllMocks();
});
it("rejects missing or short secrets before opening storage", async () => {
  vi.stubEnv("SESSION_SECRET", "");
  vi.stubEnv("ADMIN_PASSWORD_HASH", "");
  await expect(import("../server/start")).rejects.toThrow(
    "Задайте SESSION_SECRET",
  );
  vi.resetModules();
  vi.stubEnv("SESSION_SECRET", "short");
  await expect(import("../server/start")).rejects.toThrow();
  vi.resetModules();
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  await expect(import("../server/start")).rejects.toThrow();
});
it("starts with defaults and shuts down gracefully with deadline", async () => {
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  vi.stubEnv("ADMIN_PASSWORD_HASH", "hash");
  vi.stubEnv("DATABASE_PATH", undefined);
  vi.stubEnv("UPLOAD_DIR", undefined);
  vi.stubEnv("PORT", undefined);
  vi.stubEnv("NODE_ENV", "test");
  vi.useFakeTimers();
  const callbacks: ((...args: unknown[]) => void)[] = [];
  vi.spyOn(process, "on").mockImplementation((name, callback) => {
    if (name === "SIGTERM" || name === "SIGINT") callbacks.push(callback);
    return process;
  });
  const exit = vi
    .spyOn(process, "exit")
    .mockImplementation((() => {}) as never);
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../server/start");
  expect(mocks.store).toHaveBeenCalledWith("data/portal.sqlite");
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ uploadDir: "uploads", production: false }),
  );
  expect(mocks.listen).toHaveBeenCalledWith(3001, "0.0.0.0");
  callbacks[0]();
  expect(mocks.storeClose).toHaveBeenCalled();
  expect(exit).toHaveBeenCalledWith(0);
  vi.advanceTimersByTime(10000);
  expect(exit).toHaveBeenCalledWith(1);
});
it("honors production configuration", async () => {
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  vi.stubEnv("ADMIN_PASSWORD_HASH", "hash");
  vi.stubEnv("DATABASE_PATH", "custom.sqlite");
  vi.stubEnv("UPLOAD_DIR", "files");
  vi.stubEnv("PORT", "4567");
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(process, "on").mockImplementation(() => process);
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../server/start");
  expect(mocks.store).toHaveBeenCalledWith("custom.sqlite");
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ uploadDir: "files", production: true }),
  );
  expect(mocks.listen).toHaveBeenCalledWith(4567, "0.0.0.0");
});

it("supports an operator-pinned published version for disconnected environments", async () => {
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  vi.stubEnv("ADMIN_PASSWORD_HASH", "hash");
  vi.stubEnv("UPDATE_RELEASE_VERSION", "2.3.4");
  vi.spyOn(process, "on").mockImplementation(() => process);
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../server/start");
  const options = mocks.create.mock.calls[0][0] as {
    resolveDeploymentVersion: () => Promise<string>;
  };
  expect(await options.resolveDeploymentVersion()).toBe("2.3.4");
});
