import { useState } from "react";
import { it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../src/shared/ui/select";
const options = [
  { value: "all", label: "Все годы" },
  { value: "2022", label: "2022" },
  { value: "2023", label: "2023" },
  { value: "2024", label: "2024" },
];
function Field() {
  const [value, setValue] = useState("2023");
  return (
    <>
      <Select label="Год" value={value} onChange={setValue} options={options} />
      <button>Дальше</button>
    </>
  );
}
it("shows a custom list, marks the selected year and selects it by pointer", async () => {
  const user = userEvent.setup();
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Год" });
  expect(trigger).toHaveTextContent("2023");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  await user.click(trigger);
  const list = screen.getByRole("listbox", { name: "Год" });
  expect(within(list).getByRole("option", { name: "2023" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const option = within(list).getByRole("option", { name: "2022" });
  fireEvent.pointerMove(option);
  expect(option).toHaveAttribute("data-highlighted", "true");
  expect(fireEvent.mouseDown(option)).toBe(false);
  await user.click(option);
  expect(trigger).toHaveTextContent("2022");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.click(trigger);
  await user.click(trigger);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
it("supports arrows, wrapping, Home, End, Enter, Space, Escape and Tab without committing cancelled choices", async () => {
  const user = userEvent.setup();
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Год" });
  trigger.focus();
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(trigger).toHaveAttribute(
    "aria-activedescendant",
    screen.getByRole("option", { name: "2024" }).id,
  );
  await user.keyboard("{ArrowDown}");
  expect(trigger).toHaveAttribute(
    "aria-activedescendant",
    screen.getByRole("option", { name: "Все годы" }).id,
  );
  await user.keyboard("{ArrowUp}{Home}{End} ");
  expect(trigger).toHaveTextContent("2024");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.keyboard("{ArrowUp}{Home}{Escape}");
  expect(trigger).toHaveTextContent("2024");
  expect(trigger).toHaveFocus();
  await user.keyboard("{Enter}{Home}{Enter}");
  expect(trigger).toHaveTextContent("Все годы");
  await user.keyboard(" ");
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  await user.tab();
  expect(screen.getByRole("button", { name: "Дальше" })).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});
it("supports typeahead and closes when focus or pointer leaves the control", async () => {
  const user = userEvent.setup();
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Год" });
  trigger.focus();
  await user.keyboard("2024{Enter}");
  expect(trigger).toHaveTextContent("2024");
  await user.keyboard("в{Enter}");
  expect(trigger).toHaveTextContent("Все годы");
  await user.keyboard("Q");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.click(trigger);
  fireEvent.blur(trigger, {
    relatedTarget: screen.getByRole("button", { name: "Дальше" }),
  });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});
it("handles disabled and empty controls and exposes a placeholder for an unknown value", async () => {
  const change = vi.fn();
  const { rerender } = render(
    <Select
      label="Год"
      value="all"
      options={options}
      onChange={change}
      disabled
    />,
  );
  const trigger = screen.getByRole("combobox", { name: "Год" });
  expect(trigger).toBeDisabled();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(change).not.toHaveBeenCalled();
  rerender(
    <Select label="Год" value="missing" options={[]} onChange={change} />,
  );
  expect(trigger).toBeDisabled();
  expect(trigger).toHaveTextContent("Выберите");
  fireEvent.keyDown(trigger, { key: "Enter" });
  rerender(
    <Select label="Год" value="missing" options={options} onChange={change} />,
  );
  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute(
    "aria-activedescendant",
    screen.getByRole("option", { name: "Все годы" }).id,
  );
});
