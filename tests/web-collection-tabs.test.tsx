import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { CollectionTabs } from "../src/shared/ui/collection-tabs";
it("moves focus and selection with arrows, Home and End, wrapping around", () => {
  function Tabs() {
    const [value, setValue] = useState("active");
    return (
      <CollectionTabs
        label="Collection"
        prefix="example"
        value={value}
        options={[
          { value: "active", label: "Active" },
          { value: "archive", label: "Archive" },
        ]}
        onChange={setValue}
      />
    );
  }
  render(<Tabs />);
  const active = screen.getByRole("tab", { name: "Active" }),
    archive = screen.getByRole("tab", { name: "Archive" });
  active.focus();
  fireEvent.keyDown(active, { key: "ArrowLeft" });
  expect(archive).toHaveFocus();
  expect(archive).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(archive, { key: "ArrowRight" });
  expect(active).toHaveFocus();
  fireEvent.keyDown(active, { key: "End" });
  expect(archive).toHaveFocus();
  fireEvent.keyDown(archive, { key: "Home" });
  expect(active).toHaveFocus();
  fireEvent.keyDown(active, { key: "Escape" });
  expect(active).toHaveFocus();
  fireEvent.click(archive);
  expect(archive).toHaveAttribute("aria-selected", "true");
});
it("ignores navigation for a disabled or empty collection", () => {
  const change = vi.fn();
  const props = {
    label: "Collection",
    prefix: "example",
    value: "active",
    options: [{ value: "active", label: "Active" }],
    onChange: change,
  };
  const view = render(<CollectionTabs {...props} disabled />);
  fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
  expect(change).not.toHaveBeenCalled();
  view.rerender(<CollectionTabs {...props} options={[]} />);
  fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
  expect(change).not.toHaveBeenCalled();
});
