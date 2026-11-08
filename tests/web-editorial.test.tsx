import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TextWithLinks } from "../src/shared/ui/text-with-links";
describe("editorial sources", () => {
  it("makes HTTPS sources operable while preserving plain text and escaping HTML", () => {
    render(
      <p>
        <TextWithLinks
          text={
            "6 сентября 2026 · Москва\nИсточник: https://t.me/moskvasevchelovek/8514\n<img src=x onerror=alert(1)> javascript:alert(1)"
          }
        />
      </p>,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://t.me/moskvasevchelovek/8514",
    );
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noreferrer");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/javascript:alert/)).toHaveTextContent(
      "6 сентября 2026",
    );
  });
});

import { sortMedia } from "../src/shared/lib/media-chronology";
import type { MediaRecord } from "../contracts/content";
it("orders the historical archive in both directions and keeps unknown dates last", () => {
  const media = [undefined, "2026-11-08", "2022-11-27", "", "2022-11-27"].map(
    (eventDate, index): MediaRecord => ({
      id: String(index),
      title: "Архив",
      description: "",
      url: "/x.jpg",
      kind: "image",
      published: true,
      eventDate,
    }),
  );
  expect(sortMedia(media, "asc").map((m) => m.id)).toEqual([
    "2",
    "4",
    "1",
    "0",
    "3",
  ]);
  expect(sortMedia(media, "desc").map((m) => m.id)).toEqual([
    "1",
    "2",
    "4",
    "0",
    "3",
  ]);
  expect(media.map((m) => m.id)).toEqual(["0", "1", "2", "3", "4"]);
});
