import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UpdateEditor } from "../src/pages/admin/ui/update-editor";
import type { DeploymentRecord } from "../contracts/content";
function mount(handler: (url: string, options?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => handler(url, options),
    })),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <UpdateEditor csrf="csrf" />
    </QueryClientProvider>,
  );
  return client;
}
it("saves an explicit Moscow update time, preserves failed input, prevents overlap and cancels", async () => {
  let fail = false;
  let jobs: DeploymentRecord[] = [];
  mount((url, options) => {
    if (!options?.method)
      return { enabled: false, currentVersion: "local", jobs };
    if (fail) throw new Error("Нет связи");
    if (options.method === "POST")
      jobs = [
        {
          ...JSON.parse(String(options.body)),
          version: "1.2.3",
          id: "job",
          createdAt: "2026-11-08T00:00:00Z",
          status: "scheduled",
          detail: "",
        },
      ];
    if (options.method === "DELETE")
      jobs = jobs.map((job) => ({ ...job, status: "cancelled" }));
    return { ok: true };
  });
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем");
  await screen.findByText(/Локальный режим/);
  const user = userEvent.setup();
  expect(screen.queryByLabelText("Версия обновления")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Дата и время обновления (МСК)"), {
    target: { value: "2026-12-01T03:00" },
  });
  fail = true;
  await user.click(
    screen.getByRole("button", { name: "Запланировать обновление" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Нет связи");
  expect(screen.getByLabelText("Дата и время обновления (МСК)")).toHaveValue(
    "2026-12-01T03:00",
  );
  fail = false;
  await user.click(
    screen.getByRole("button", { name: "Запланировать обновление" }),
  );
  expect(await screen.findByText("Запланировано")).toBeInTheDocument();
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    scheduledAt: "2026-12-01T00:00:00.000Z",
  });
  expect(
    screen.getByRole("button", { name: "Запланировать обновление" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Отменить обновление" }));
  expect(await screen.findByText("Отменено")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Запланировать обновление" }),
  ).toBeEnabled();
});
it("retries schedule loading and displays worker outcomes without cancellation of running jobs", async () => {
  let fail = true;
  const jobs: DeploymentRecord[] = ["running", "succeeded", "failed"].map(
    (status, i) => ({
      id: String(i),
      version: "1.0.0",
      scheduledAt: "2026-12-01T00:00:00Z",
      createdAt: "2026-11-08T00:00:00Z",
      status: status as DeploymentRecord["status"],
      detail: "Результат проверки",
    }),
  );
  mount(() => {
    if (fail) throw new Error("offline");
    return { enabled: true, currentVersion: "1.0.0", jobs };
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не удалось загрузить",
  );
  fail = false;
  await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await waitFor(() =>
    expect(screen.getByText("Выполняется")).toBeInTheDocument(),
  );
  expect(screen.getByText("Завершено")).toBeInTheDocument();
  expect(screen.getByText("Ошибка")).toBeInTheDocument();
  expect(screen.queryByText(/Локальный режим/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отменить обновление" }),
  ).not.toBeInTheDocument();
});
