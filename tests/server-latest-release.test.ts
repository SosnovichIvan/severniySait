import { it, expect, vi } from "vitest";
import { latestRelease } from "../server/domain/latest-release";
function registry(tags: unknown, status = 200, headers: HeadersInit = {}) {
  return vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "test-token" })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ tags }), { status, headers }),
    );
}
it("selects the numerically newest published stable image and uses bounded registry requests", async () => {
  const fetcher = registry([
    "1.9.0",
    "1.10.0",
    "2.0.0",
    "2.0.0-beta",
    "latest",
    "2.0.0",
    "1.99.9",
    "1.10.1",
  ]);
  expect(await latestRelease(fetcher)).toBe("2.0.0");
  expect(fetcher.mock.calls[1][0]).toBe(
    "https://ghcr.io/v2/sosnovichivan/severniysait/tags/list?n=1000",
  );
  expect(fetcher.mock.calls[1][1]).toMatchObject({
    headers: { Authorization: "Bearer test-token" },
    signal: expect.any(AbortSignal),
  });
  expect(await latestRelease(registry(["1.9.0", "1.10.0", "1.10.1"]))).toBe(
    "1.10.1",
  );
});
it("handles an empty or missing package without inventing a version", async () => {
  for (const tags of [[], null, ["latest", "preview"]])
    expect(await latestRelease(registry(tags))).toBeNull();
  expect(await latestRelease(registry([], 404))).toBeNull();
});
it("rejects unavailable, invalid and incomplete listings and propagates timeouts", async () => {
  await expect(
    latestRelease(vi.fn().mockResolvedValue(new Response("", { status: 403 }))),
  ).rejects.toThrow();
  await expect(
    latestRelease(vi.fn().mockResolvedValue(new Response("{}"))),
  ).rejects.toThrow();
  await expect(latestRelease(registry([], 503))).rejects.toThrow();
  await expect(latestRelease(registry("invalid"))).rejects.toThrow();
  await expect(
    latestRelease(registry(["1.0.0"], 200, { link: '</next>; rel="next"' })),
  ).rejects.toThrow();
  await expect(
    latestRelease(vi.fn().mockRejectedValue(new Error("timeout"))),
  ).rejects.toThrow("timeout");
});
