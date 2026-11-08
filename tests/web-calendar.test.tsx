import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalPage } from "../src/pages/portal";
import { getMoscowDate } from "../src/shared/lib/calendar-date";
afterEach(() => vi.useRealTimers());
function calendar() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["content"], { events: [], media: [] });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/calendar"]}>
        <PortalPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("uses Moscow date at UTC boundaries, including New Year", () => {
  expect(getMoscowDate(new Date("2026-11-07T20:59:59Z"))).toEqual({
    year: 2026,
    month: 10,
    day: 7,
  });
  expect(getMoscowDate(new Date("2026-11-07T21:00:00Z"))).toEqual({
    year: 2026,
    month: 10,
    day: 8,
  });
  expect(getMoscowDate(new Date("2026-12-31T21:00:00Z"))).toEqual({
    year: 2027,
    month: 0,
    day: 1,
  });
});
it("opens today, retains its marker after selection, and returns from another month", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  calendar();
  const today = screen.getByRole("button", { name: "8" });
  expect(today).toHaveAttribute("aria-current", "date");
  expect(today).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "15" }));
  expect(today).toHaveAttribute("aria-current", "date");
  expect(screen.getByRole("button", { name: "15" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Следующий месяц" }));
  expect(document.querySelector("[aria-current=date]")).toBeNull();
  expect(screen.getByText(/Сегодня, 8 ноября 2026/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Сегодня" }));
  expect(screen.getByRole("button", { name: "8" })).toHaveAttribute(
    "aria-current",
    "date",
  );
  expect(screen.getByRole("button", { name: "8" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("updates today at midnight and when the window regains focus", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-08T20:59:30Z"));
  const view = calendar();
  expect(screen.getByRole("button", { name: "8" })).toHaveAttribute(
    "aria-current",
    "date",
  );
  act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByRole("button", { name: "9" })).toHaveAttribute(
    "aria-current",
    "date",
  );
  expect(screen.getByRole("button", { name: "8" })).not.toHaveAttribute(
    "aria-current",
  );
  vi.setSystemTime(new Date("2026-11-10T06:00:00Z"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(screen.getByRole("button", { name: "10" })).toHaveAttribute(
    "aria-current",
    "date",
  );
  view.unmount();
});
