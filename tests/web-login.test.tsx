import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../src/app/shell";
import { LoginDialog } from "../src/features/editor-login";
function Path() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}
function mount(
  path = "/media",
  session: unknown = { admin: false, csrf: "token" },
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  client.setQueryData(["content"], { events: [], media: [] });
  client.setQueryData(["admin-content"], { events: [], media: [] });
  if (session) client.setQueryData(["session"], session);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Path />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
it("opens over the current page, focuses the password and restores focus after all dismissal paths", async () => {
  const user = userEvent.setup();
  mount();
  const trigger = screen.getByRole("button", { name: "Войти для редакции" });
  await user.click(trigger);
  let dialog = screen.getByRole("dialog", { name: "Вход в админку" });
  expect(screen.getByTestId("path")).toHaveTextContent("/media");
  expect(screen.getByLabelText("Пароль администратора")).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  await user.click(within(dialog).getByRole("heading"));
  expect(dialog).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Закрыть окно входа" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
  await user.click(trigger);
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  dialog = screen.getByRole("dialog");
  fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(trigger);
  fireEvent.click(screen.getByRole("dialog"));
  expect(trigger).toHaveFocus();
});
it("shows session loading and failure, and retries without leaving the page", async () => {
  let reject!: (reason: Error) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((_resolve, r) => {
          reject = r;
        }),
    ),
  );
  mount("/media", null);
  await userEvent.click(
    screen.getByRole("button", { name: "Войти для редакции" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Проверяем сессию");
  reject(new Error("offline"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не удалось проверить вход",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ admin: false, csrf: "token" }),
    })),
  );
  await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(await screen.findByLabelText("Пароль администратора")).toHaveFocus();
  expect(screen.getByTestId("path")).toHaveTextContent("/media");
});
it("prevents duplicate submissions, preserves a rejected password, and enters the editor after success", async () => {
  const user = userEvent.setup();
  const client = mount();
  let reject!: (reason: Error) => void;
  const post = vi.fn(
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
  );
  vi.stubGlobal("fetch", post);
  await user.click(screen.getByRole("button", { name: "Войти для редакции" }));
  const input = screen.getByLabelText("Пароль администратора");
  await user.type(input, "wrong-password");
  await user.click(screen.getByRole("button", { name: "Войти" }));
  expect(screen.getByRole("button", { name: "Входим…" })).toBeDisabled();
  fireEvent.submit(input.closest("form")!);
  expect(post).toHaveBeenCalledTimes(1);
  reject(new Error("Неверный пароль."));
  expect(await screen.findByRole("alert")).toHaveTextContent("Неверный пароль");
  expect(input).toHaveValue("wrong-password");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ admin: true, csrf: "rotated" }),
    })),
  );
  await user.click(screen.getByRole("button", { name: "Войти" }));
  await waitFor(() =>
    expect(screen.getByTestId("path")).toHaveTextContent("/admin"),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Редакция." })).toBeVisible();
  expect(client.getQueryData(["session"])).toEqual({
    admin: true,
    csrf: "rotated",
  });
});
it("opens the modal for a direct admin URL and returns home on cancel", async () => {
  mount("/admin");
  expect(
    await screen.findByRole("dialog", { name: "Вход в админку" }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Закрыть окно входа" }),
  );
  expect(screen.getByTestId("path")).toHaveTextContent("/");
  expect(
    screen.getByRole("heading", { name: "Северный человек" }),
  ).toBeVisible();
});
it("recognizes an existing editor session", async () => {
  mount("/media", { admin: true, csrf: "token" });
  await userEvent.click(
    screen.getByRole("button", { name: "Войти для редакции" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("path")).toHaveTextContent("/admin"),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
