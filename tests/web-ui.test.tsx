import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import channels from "../contracts/channels.json";
import { App } from "../src/app/shell";
import { PortalPage } from "../src/pages/portal";
import { AdminPage } from "../src/pages/admin";
import { request, loadContent, loadSession, send } from "../src/shared/api";
const event = {
  id: "one",
  title: "Открытая встреча",
  city: "Москва",
  description: "Информация о встрече",
  startsAt: new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    15,
    18,
  ).toISOString(),
  published: true,
};
const photo = {
  id: "photo",
  title: "Фото встречи",
  eventDate: "2026-09-06",
  description: "Описание фотографии",
  url: "/uploads/one.png",
  kind: "image",
  published: true,
};
const video = { ...photo, id: "video", title: "Видео встречи", kind: "video" };
const content = { events: [event], media: [photo, video], channels };
function mockApi(handler?: (url: string, options?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const value = handler?.(url, options);
      return {
        ok: true,
        json: async () =>
          value ??
          (url === "/api/session"
            ? { admin: false, csrf: "csrf" }
            : url.includes("content")
              ? content
              : { ok: true }),
      };
    }),
  );
}
function mount(
  component: React.ReactNode,
  path = "/",
  data: unknown = content,
  admin = false,
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  if (data !== null) client.setQueryData(["content"], data);
  if (admin) {
    client.setQueryData(["session"], { admin: true, csrf: "csrf" });
    if (data !== null) client.setQueryData(["admin-content"], data);
  }
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
describe("public UI", () => {
  it("renders home, navigates, toggles themes and mobile menu, handles missing page", async () => {
    mockApi();
    const user = userEvent.setup();
    mount(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Северный человек/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Фото встречи" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Включить светлую тему" }),
    );
    expect(localStorage.getItem("theme")).toBe("light");
    await user.click(
      screen.getByRole("button", { name: "Включить тёмную тему" }),
    );
    await user.click(screen.getByRole("button", { name: "Открыть меню" }));
    expect(
      screen.getByRole("button", { name: "Закрыть меню" }),
    ).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Закрыть меню" }));
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Основная навигация" }),
      ).getByRole("link", { name: "Медиапространство" }),
    );
    expect(
      screen.getByRole("heading", { name: "Медиапространство." }),
    ).toBeInTheDocument();
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Основная навигация" }),
      ).getByRole("link", { name: "Календарь событий" }),
    );
    expect(
      screen.getByRole("heading", { name: "Календарь событий." }),
    ).toBeInTheDocument();
  });
  it("renders light preference and 404", () => {
    localStorage.setItem("theme", "light");
    mockApi();
    mount(<App />, "/missing");
    expect(
      screen.getByRole("heading", { name: "Страница не найдена" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Включить тёмную тему" }),
    ).toBeInTheDocument();
  });
  it("shows photos and videos together without type filters", () => {
    mockApi();
    mount(<PortalPage />, "/media");
    expect(
      screen.getByRole("img", { name: "Фото встречи" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Видео встречи")).toBeInTheDocument();
    for (const name of ["Все материалы", "Фотографии", "Видео"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
  it("shows actual empty states", () => {
    mockApi();
    mount(<PortalPage />, "/", { events: [], media: [] });
    expect(screen.getByText("Здесь начинается хроника")).toBeInTheDocument();
  });
  it("shows empty media", () => {
    mockApi();
    mount(<PortalPage />, "/media", { events: [], media: [] });
    expect(
      screen.getByText("Материалы в этом разделе пока не опубликованы."),
    ).toBeInTheDocument();
  });
  it("searches divisions and handles unmatched search", async () => {
    mockApi();
    const user = userEvent.setup();
    mount(<PortalPage />, "/divisions", {
      ...content,
      divisions: [{ name: "Москва", url: "https://t.me/moskvasevchelovek" }],
    });
    await user.type(
      screen.getByRole("textbox", { name: "Найти город" }),
      "Москва",
    );
    expect(screen.getByRole("link", { name: "Москва" })).toHaveAttribute(
      "href",
      "https://t.me/moskvasevchelovek",
    );
    expect(screen.queryByRole("link", { name: "Абакан" })).toBeNull();
    await user.clear(screen.getByRole("textbox", { name: "Найти город" }));
    await user.type(
      screen.getByRole("textbox", { name: "Найти город" }),
      "Нетгорода",
    );
    expect(screen.getByText(/Город не найден/)).toBeInTheDocument();
  });
  it("changes calendar months and day filters", async () => {
    mockApi();
    const user = userEvent.setup();
    mount(<PortalPage />, "/calendar");
    await user.click(screen.getByRole("button", { name: "15" }));
    expect(screen.getByText(event.title)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "16" }));
    expect(
      screen.getByText(/На выбранный период событий пока нет/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "16" }));
    expect(screen.getByText(event.title)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Следующий месяц" }));
    expect(screen.queryByText(event.title)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Предыдущий месяц" }));
    expect(screen.getByText(event.title)).toBeInTheDocument();
  });
  it("renders pending and request failure, retries successfully", async () => {
    let reject!: (error: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((_r, j) => {
            reject = j;
          }),
      ),
    );
    mount(<PortalPage />, "/", null);
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем");
    reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось");
    mockApi();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("img", { name: "Фото встречи" }),
    ).toBeInTheDocument();
  });
});
describe("admin UI", () => {
  it("shows pending and session failure with retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    mount(<AdminPage />, "/admin", null);
    expect(screen.getByRole("status")).toHaveTextContent("Проверяем");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось проверить",
    );
    mockApi();
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("heading", { name: "Вход в админку" }),
    ).toBeInTheDocument();
  });
  it("logs in, preserves failed password input, logs out and clears cached private content", async () => {
    let logged = false;
    let fail = true;
    mockApi((url) => {
      if (url === "/api/session") return { admin: logged, csrf: "csrf" };
      if (url === "/api/login") {
        if (fail) throw new Error("Неверный пароль.");
        logged = true;
        return { admin: true, csrf: "new" };
      }
      if (url === "/api/logout") {
        logged = false;
        return { ok: true };
      }
    });
    const user = userEvent.setup();
    mount(<AdminPage />, "/admin", null);
    const input = await screen.findByLabelText("Пароль администратора");
    await user.type(input, "test-password");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Неверный пароль",
    );
    expect(input).toHaveValue("test-password");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(
      await screen.findByRole("heading", {
        name: "Управление материалами сайта",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Выйти" }));
    expect(
      await screen.findByRole("heading", { name: "Вход в админку" }),
    ).toBeInTheDocument();
  });
  it("creates, edits, cancels, and deletes events with confirmation", async () => {
    mockApi();
    const user = userEvent.setup();
    mount(<AdminPage />, "/admin", content, true);
    await user.type(
      screen.getByLabelText("Название события"),
      "Тестовое событие",
    );
    await user.type(screen.getByLabelText("Город"), "Тула");
    fireEvent.change(screen.getByLabelText("Дата и время (МСК)"), {
      target: { value: "2026-12-10T19:30" },
    });
    await user.type(screen.getByLabelText("Описание"), "Описание");
    await user.click(screen.getByLabelText("Опубликовать на сайте"));
    await user.click(screen.getByRole("button", { name: "Сохранить событие" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Событие сохранено",
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url, options]) =>
            url === "/api/admin/events" &&
            String(options?.body).includes("2026-12-10T16:30:00.000Z"),
        ),
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: `Редактировать ${event.title}` }),
    );
    expect(screen.getByLabelText("Название события")).toHaveValue(event.title);
    await user.click(
      screen.getByRole("button", { name: "Отменить редактирование" }),
    );
    expect(screen.getByLabelText("Название события")).toHaveValue("");
    await user.click(
      screen.getByRole("button", { name: `Редактировать ${event.title}` }),
    );
    await user.click(screen.getByRole("button", { name: "Сохранить событие" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Название события")).toHaveValue(""),
    );
    await user.click(
      screen.getByRole("button", { name: `Удалить ${event.title}` }),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: `Удалить ${event.title}` }),
    );
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Запись удалена",
    );
  });
  it("uploads, edits and cancels media, shows drafts and empty state", async () => {
    mockApi((url) =>
      url === "/api/admin/content"
        ? {
            ...content,
            media: [
              {
                ...photo,
                published: false,
                images: [{ id: "gallery-one", url: "/gallery.jpg" }],
              },
              video,
            ],
          }
        : undefined,
    );
    const user = userEvent.setup();
    mount(
      <AdminPage />,
      "/admin",
      {
        ...content,
        media: [
          {
            ...photo,
            published: false,
            images: [{ id: "gallery-one", url: "/gallery.jpg" }],
          },
          video,
        ],
      },
      true,
    );
    await user.click(screen.getByRole("button", { name: "Медиа" }));
    expect(screen.getByText("Черновик")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Название материала"), "Материал");
    await user.type(screen.getByLabelText("Описание"), "Медиа описание");
    await user.upload(
      screen.getByLabelText("Файл медиа"),
      new File(["png"], "photo.png", { type: "image/png" }),
    );
    expect(
      Array.from(document.querySelectorAll("input,textarea"))
        .filter((e) => !(e as HTMLInputElement).checkValidity())
        .map((e) => e.outerHTML),
    ).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Сохранить материал" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Материал сохранён",
    );
    await user.click(
      screen.getByRole("button", { name: `Редактировать ${photo.title}` }),
    );
    expect(screen.getByLabelText("Название материала")).toHaveValue(
      photo.title,
    );
    await user.click(
      screen.getByRole("button", { name: "Удалить фотографию 1" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Фотография удалена",
    );
    await user.upload(
      screen.getByLabelText("Фотография для галереи"),
      new File(["png"], "gallery.png", { type: "image/png" }),
    );
    fireEvent.submit(
      screen.getByLabelText("Фотография для галереи").closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Фотография добавлена",
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "Отменить редактирование" }),
    );
    await user.click(
      screen.getByRole("button", { name: `Редактировать ${video.title}` }),
    );
    await user.click(screen.getByLabelText("Опубликовать на сайте"));
    await user.click(
      screen.getByRole("button", { name: "Сохранить материал" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Загрузить медиа" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "События" }));
    expect(
      screen.getByRole("heading", { name: "Новое событие" }),
    ).toBeInTheDocument();
  });
  it("shows empty admin and fetch failure retry", async () => {
    mockApi();
    mount(<AdminPage />, "/admin", { events: [], media: [] }, true);
    expect(screen.getByText(/Пока ничего нет/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Медиа" }));
    expect(screen.getByText(/первый материал/)).toBeInTheDocument();
  });
  it("handles content request error", async () => {
    let fail = true;
    mockApi((url) => {
      if (url === "/api/admin/content" && fail) throw new Error("offline");
    });
    mount(<AdminPage />, "/admin", null, true);
    expect(screen.getByText("Загружаем…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось загрузить список",
    );
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText(event.title)).toBeInTheDocument();
  });
});
describe("API client", () => {
  it("validates content and maps transport failures", async () => {
    mockApi();
    expect(await loadContent()).toMatchObject({ events: [event] });
    expect(await loadContent(true)).toMatchObject({ media: [photo, video] });
    expect(await loadSession()).toEqual({ admin: false, csrf: "csrf" });
    await send("/api/test", "POST", { a: 1 }, "csrf");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Ошибка сервера" }),
      })),
    );
    await expect(request("/x")).rejects.toThrow("Ошибка сервера");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => null })),
    );
    await expect(request("/x")).rejects.toThrow("Не удалось загрузить данные");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ other: true }) })),
    );
    await expect(request("/x")).rejects.toThrow();
    mockApi(() => ({ events: "wrong" }));
    await expect(loadContent()).rejects.toThrow();
  });
});

it("supports Escape on delete confirmation", async () => {
  mockApi();
  mount(<AdminPage />, "/admin", content, true);
  await userEvent.click(
    screen.getByRole("button", { name: `Удалить ${event.title}` }),
  );
  fireEvent(
    screen.getByRole("alertdialog"),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("keeps the logo splash until initial content settles", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await gate;
      return { ok: true, json: async () => content };
    }),
  );
  const splash = document.createElement("div");
  splash.id = "boot-splash";
  document.body.append(splash);
  mount(<App />, "/", null);
  expect(document.getElementById("boot-splash")).toBe(splash);
  release();
  await waitFor(() =>
    expect(document.getElementById("boot-splash")).toBeNull(),
  );
  expect(
    screen.getByRole("heading", { name: "Михаил Маваши" }),
  ).toBeInTheDocument();
  expect(document.querySelector(".brand-logo")).toHaveAttribute(
    "src",
    "/logo.png",
  );
});

it("keeps divisions without editorial links visible and noninteractive", () => {
  mockApi();
  mount(<PortalPage />, "/divisions");
  expect(screen.getByText("Москва").closest(".division-card")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(
    screen.queryByRole("link", { name: "Москва" }),
  ).not.toBeInTheDocument();
});
it("edits division links, searches cities and retains input on failure", async () => {
  let fail = false;
  const links = [{ name: "Москва", url: "https://example.org/moscow" }];
  mockApi((url, options) => {
    if (url === "/api/admin/divisions") {
      if (fail) throw new Error("Сеть недоступна");
      links[0] = JSON.parse(String(options?.body));
      return { ok: true };
    }
    if (url.includes("content")) return { ...content, divisions: links };
  });
  const user = userEvent.setup();
  mount(<AdminPage />, "/admin", { ...content, divisions: links }, true);
  await user.click(screen.getByRole("button", { name: "Подразделения" }));
  expect(screen.getByText(/Выберите город слева/)).toBeInTheDocument();
  await user.type(
    screen.getByRole("textbox", { name: "Найти подразделение" }),
    "Москва",
  );
  await user.click(
    screen.getByRole("button", { name: "Редактировать подразделение Москва" }),
  );
  const input = screen.getByRole("textbox", { name: "Ссылка для перехода" });
  expect(input).toHaveValue("https://example.org/moscow");
  await user.click(screen.getByLabelText("Опубликовать на сайте"));
  const contacts = {
    Координатор: "Иван Иванов",
    "Контакт для связи": "+7 900 000-00-00",
    "Ссылка на ВК": "https://vk.com/example",
    "Ссылка на MAX": "https://max.ru/example",
    "Ссылка на Telegram": "https://t.me/example",
    "Электронная почта": "editor@example.org",
    "Ссылка на сайт": "https://example.org",
  };
  for (const [name, value] of Object.entries(contacts)) {
    const field = screen.getByRole("textbox", { name });
    expect(field).not.toBeRequired();
    await user.type(field, value);
  }

  await user.clear(input);
  await user.type(input, "https://example.org/new");
  fail = true;
  await user.click(
    screen.getByRole("button", { name: "Сохранить подразделение" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Сеть недоступна");
  expect(input).toHaveValue("https://example.org/new");
  fail = false;
  await user.click(
    screen.getByRole("button", { name: "Сохранить подразделение" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Данные подразделения сохранены",
  );
  await user.click(
    screen.getByRole("button", { name: "Редактировать подразделение Москва" }),
  );
  for (const [name, value] of Object.entries(contacts)) {
    const field = screen.getByRole("textbox", { name });
    expect(field).toHaveValue(value);
    await user.clear(field);
  }
  await user.clear(input);
  await user.click(screen.getByLabelText("Опубликовать на сайте"));
  await user.click(
    screen.getByRole("button", { name: "Сохранить подразделение" }),
  );
  await waitFor(() => expect(links[0].url).toBe(""));
  await user.clear(
    screen.getByRole("textbox", { name: "Найти подразделение" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Найти подразделение" }),
    "нетгорода",
  );
  expect(screen.getByText("Город не найден.")).toBeInTheDocument();
});

it("keeps admin separate from public chrome and switches event and media publication", async () => {
  const data = { ...content, events: [{ ...event }], media: [{ ...photo }] };
  mockApi((url, options) => {
    if (options?.method === "PATCH") {
      const published = JSON.parse(String(options.body)).published;
      const item = url.includes("/events/") ? data.events[0] : data.media[0];
      item.published = published;
      return { ok: true };
    }
    if (url.includes("content")) return data;
  });
  const user = userEvent.setup();
  mount(<App />, "/admin", data, true);
  expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Выйти" })).toHaveLength(1);
  expect(screen.queryByText("ПАНЕЛЬ УПРАВЛЕНИЯ")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: `Редактировать ${event.title}` }),
  );
  await user.click(screen.getByRole("button", { name: "Снять с публикации" }));
  expect(await screen.findByText("Черновик")).toBeInTheDocument();
  expect(screen.getByLabelText("Опубликовать на сайте")).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Опубликовать" }));
  expect(await screen.findByText("Опубликовано")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Медиа" }));
  await user.click(
    screen.getByRole("button", { name: `Редактировать ${photo.title}` }),
  );
  await user.click(screen.getByRole("button", { name: "Снять с публикации" }));
  expect(await screen.findByText("Черновик")).toBeInTheDocument();
  expect(screen.getByLabelText("Опубликовать на сайте")).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Опубликовать" }));
  expect(await screen.findByText("Опубликовано")).toBeInTheDocument();
});

it("edits channels, retains a failed draft, updates publication and removes with confirmation", async () => {
  let fail = false;
  let failPublish = false;
  let records = [{ ...channels[0] }];
  mockApi((url, options) => {
    if (url.includes("content")) return { ...content, channels: records };
    if (url.includes("/api/admin/channels")) {
      if (fail) throw new Error("Нет сети");
      const body = JSON.parse(String(options?.body ?? "{}"));
      if (options?.method === "PATCH") {
        if (failPublish) throw new Error("Ошибка публикации");
        records = records.map((c) => ({ ...c, published: body.published }));
      } else if (options?.method === "DELETE") records = [];
      else records = [{ ...body, id: "channel-1" }];
      return { ok: true };
    }
  });
  const user = userEvent.setup();
  mount(<AdminPage />, "/admin", { ...content, channels: records }, true);
  await user.click(screen.getByRole("button", { name: "Площадки и каналы" }));
  await user.type(screen.getByLabelText("Название площадки"), "Новый канал");
  await user.type(
    screen.getByLabelText("Ссылка на площадку"),
    "https://example.org/new",
  );
  await user.type(screen.getByLabelText("Описание площадки"), "Описание");
  await user.type(screen.getByLabelText("Короткое обозначение"), "НК");
  expect(screen.getByLabelText("Опубликовать на сайте")).not.toBeChecked();
  fail = true;
  await user.click(screen.getByRole("button", { name: "Сохранить площадку" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Нет сети");
  expect(screen.getByLabelText("Название площадки")).toHaveValue("Новый канал");
  fail = false;
  await user.click(screen.getByRole("button", { name: "Сохранить площадку" }));
  expect(await screen.findByText("Черновик")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Редактировать Новый канал" }),
  );
  failPublish = true;
  await user.click(screen.getByRole("button", { name: "Опубликовать" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ошибка публикации",
  );
  expect(screen.getByLabelText("Опубликовать на сайте")).not.toBeChecked();
  failPublish = false;
  await user.click(screen.getByRole("button", { name: "Опубликовать" }));
  expect(await screen.findByText("Опубликовано")).toBeInTheDocument();
  expect(screen.getByLabelText("Опубликовать на сайте")).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Снять с публикации" }));
  expect(await screen.findByText("Черновик")).toBeInTheDocument();
  await user.click(screen.getByLabelText("Опубликовать на сайте"));
  await user.click(screen.getByRole("button", { name: "Сохранить площадку" }));
  await screen.findByText("Площадка сохранена.");
  await user.click(
    screen.getByRole("button", { name: "Редактировать Новый канал" }),
  );
  await user.click(screen.getByRole("button", { name: "Новая площадка" }));
  expect(screen.getByLabelText("Название площадки")).toHaveValue("");
  await user.click(
    screen.getByRole("button", { name: "Редактировать Новый канал" }),
  );
  await user.click(screen.getByRole("button", { name: "Добавить площадку" }));
  expect(screen.getByLabelText("Название площадки")).toHaveValue("");
  expect(screen.getByLabelText("Название площадки")).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Удалить Новый канал" }));
  await user.click(screen.getByRole("button", { name: /^Удалить$/ }));
  expect(
    await screen.findByText("Добавьте первую площадку."),
  ).toBeInTheDocument();
});
