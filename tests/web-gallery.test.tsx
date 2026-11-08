import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PhotoGallery } from "../src/shared/ui/photo-gallery";
import { App } from "../src/app/shell";

it("navigates and loops photos by controls, thumbnails, keyboard and swipe; opens and closes fullscreen", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const user = userEvent.setup();
  const { rerender } = render(
    <PhotoGallery
      title="Событие"
      images={["/one.jpg", "/two.jpg", "/three.jpg"]}
    />,
  );
  const gallery = screen.getByRole("region", { name: "Галерея: Событие" });
  const controls = () =>
    within(gallery).getAllByRole("button", {
      name: "Следующее изображение",
    })[0];
  await user.click(controls());
  expect(screen.getByRole("img", { name: "Событие, кадр 2" })).toHaveAttribute(
    "src",
    "/two.jpg",
  );
  await user.click(screen.getByRole("button", { name: "Показать кадр 3" }));
  expect(
    screen.getByRole("button", { name: "Показать кадр 3" }),
  ).toHaveAttribute("aria-current", "true");
  await user.click(controls());
  expect(screen.getByRole("img", { name: "Событие, кадр 1" })).toBeVisible();
  await user.click(
    within(gallery).getAllByRole("button", {
      name: "Предыдущее изображение",
    })[0],
  );
  fireEvent.keyDown(gallery, { key: "Home" });
  fireEvent.keyDown(gallery, { key: "ArrowRight" });
  fireEvent.keyDown(gallery, { key: "ArrowLeft" });
  fireEvent.keyDown(gallery, { key: "End" });
  fireEvent.keyDown(gallery, { key: "Tab" });
  let stage = screen.getByRole("button", { name: /Открыть изображение/ });
  fireEvent.pointerUp(stage, { clientX: 0 });
  fireEvent.pointerDown(stage, { clientX: 200 });
  fireEvent.pointerUp(stage, { clientX: 100 });
  fireEvent.click(stage);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  stage = screen.getByRole("button", { name: /Открыть изображение/ });
  fireEvent.pointerDown(stage, { clientX: 100 });
  fireEvent.pointerUp(stage, { clientX: 200 });
  fireEvent.click(stage);
  stage = screen.getByRole("button", { name: /Открыть изображение/ });
  fireEvent.pointerDown(stage, { clientX: 100 });
  fireEvent.pointerUp(stage, { clientX: 105 });
  fireEvent.click(stage);
  const modal = screen.getByRole("dialog", {
    name: "Полноэкранный просмотр: Событие",
  });
  expect(modal).toBeVisible();
  await user.click(
    within(modal).getByRole("button", { name: "Следующее изображение" }),
  );
  await user.click(
    within(modal).getByRole("button", {
      name: "Закрыть полноэкранный просмотр",
    }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Открыть изображение/ }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.keyDown(gallery, { key: "Escape" });
  fireEvent.keyDown(gallery, { key: "End" });
  rerender(<PhotoGallery title="Событие" images={["/one.jpg"]} />);
  expect(screen.getByRole("img", { name: "Событие, кадр 1" })).toHaveAttribute(
    "src",
    "/one.jpg",
  );
  vi.unstubAllGlobals();
});

it("handles an empty gallery and a single photograph", () => {
  const { rerender } = render(<PhotoGallery title="Пусто" images={[]} />);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  rerender(<PhotoGallery title="Один кадр" images={["/one.jpg"]} />);
  expect(
    screen.getByRole("button", { name: "Следующее изображение" }),
  ).toBeDisabled();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

function detail(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/media/story"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("opens a direct material URL with date, full description, sources and photos", async () => {
  const gate: { release?: () => void } = {};
  const pending = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await pending;
      return {
        ok: true,
        json: async () => ({
          events: [],
          media: [
            {
              id: "story",
              title: "История события",
              eventDate: "2025-05-17",
              description:
                "Полная история\n\nИсточник: https://example.org/report",
              kind: "image",
              url: "/cover.jpg",
              published: true,
              images: [{ id: "two", url: "/second.jpg" }],
            },
          ],
        }),
      };
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/media/story"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем материал");
  gate.release!();
  expect(
    await screen.findByRole("heading", { name: "История события" }),
  ).toBeVisible();
  expect(screen.getByText("17 мая 2025 г.")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Открыть источник/ }),
  ).toHaveAttribute("href", "https://example.org/report");
  await userEvent.click(
    screen.getByRole("button", { name: "Следующее изображение" }),
  );
  expect(screen.getByRole("img", { name: /кадр 2/ })).toHaveAttribute(
    "src",
    "/second.jpg",
  );
});
it("renders video materials and handles a removed or unpublished material", async () => {
  const view = detail({
    events: [],
    media: [
      {
        id: "story",
        title: "Видео события",
        description: "Подробности",
        kind: "video",
        url: "/clip.mp4",
        published: true,
      },
    ],
  });
  expect(await screen.findByLabelText("Видео события")).toHaveAttribute(
    "src",
    "/clip.mp4",
  );
  expect(
    screen.queryByRole("region", { name: /Галерея:/ }),
  ).not.toBeInTheDocument();
  view.unmount();
  detail({ events: [], media: [] });
  expect(
    await screen.findByRole("heading", { name: "Материал не найден" }),
  ).toBeVisible();
});
it("offers retry after a material loading error", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/media/story"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не удалось загрузить материал",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ events: [], media: [] }),
    })),
  );
  await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Материал не найден" }),
    ).toBeVisible(),
  );
});
