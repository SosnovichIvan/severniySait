import { it, expect, vi } from "vitest";
const render = vi.hoisted(() => vi.fn());
vi.mock("react-dom/client", () => ({ createRoot: vi.fn(() => ({ render })) }));
it("mounts the app with providers", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import("../src/app/main");
  expect(render).toHaveBeenCalledOnce();
});
