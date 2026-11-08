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
