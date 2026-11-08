import { z } from "zod";
import { deploymentVersion } from "../../contracts/content.js";
const repository = "sosnovichivan/severniysait";
export function compareReleaseVersions(left: string, right: string) {
  const a = left.split(".").map(BigInt),
    b = right.split(".").map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}
export async function latestRelease(
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const auth = await fetcher(
    `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!auth.ok) throw new Error("Registry authentication failed");
  const { token } = z
    .object({ token: z.string().min(1) })
    .parse(await auth.json());
  const response = await fetcher(
    `https://ghcr.io/v2/${repository}/tags/list?n=1000`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok || response.headers.has("link"))
    throw new Error("Registry listing unavailable or incomplete");
  const { tags } = z
    .object({ tags: z.array(z.string()).nullable() })
    .parse(await response.json());
  const versions = (tags ?? []).filter(
    (tag) => deploymentVersion.safeParse(tag).success,
  );
  versions.sort((left, right) => compareReleaseVersions(right, left));
  return versions[0] ?? null;
}
