import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorDialog } from "../src/shared/ui/editor-dialog";
it("focuses a form, contains the named modal, closes on Escape and restores the opener and scrolling", async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  document.body.style.overflow = "auto";
  const { unmount } = render(
    <EditorDialog title="Редактор" busy={false} onClose={close}>
      <label>
        Название
        <input />
      </label>
    </EditorDialog>,
  );
  expect(screen.getByRole("dialog", { name: "Редактор" })).toBeInTheDocument();
  expect(screen.getByLabelText("Название")).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(close).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Закрыть редактор" }));
  expect(close).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(3);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
  expect(close).toHaveBeenCalledTimes(3);
  unmount();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe("auto");
  opener.remove();
  document.body.style.overflow = "";
});
it("blocks dismissal and controls during saving, and focuses the title for a read-only form", () => {
  const close = vi.fn();
  const { rerender, unmount } = render(
    <EditorDialog title="Архив" busy={true} onClose={close}>
      <input aria-label="Поле" disabled />
    </EditorDialog>,
  );
  expect(screen.getByRole("heading")).toHaveFocus();
  expect(screen.getByRole("button")).toBeDisabled();
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { cancelable: true }),
  );
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  rerender(
    <EditorDialog title="Архив" busy={false} onClose={close}>
      <input aria-label="Поле" />
    </EditorDialog>,
  );
  expect(screen.getByLabelText("Поле")).not.toBeDisabled();
  unmount();
});
