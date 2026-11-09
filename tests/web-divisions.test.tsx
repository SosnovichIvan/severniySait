import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DivisionEditor } from "../src/pages/admin/ui/division-editor";
import type { DivisionLink } from "../contracts/content";

it("creates districts and cities, retains a failed draft, and selects themed geography controls", async () => {
  const user = userEvent.setup();
  const onSave = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({});
  const onArchive = vi.fn();
  render(
    <DivisionEditor
      links={[]}
      pending={false}
      onSave={onSave}
      onArchive={onArchive}
    />,
  );
  expect(screen.getByText("Подразделение не найдено.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  await user.type(screen.getByLabelText("Название подразделения"), "Реутов");
  await user.click(screen.getByRole("combobox", { name: "Регион" }));
  await user.click(screen.getByRole("option", { name: "Московская область" }));
  await user.click(screen.getByRole("combobox", { name: "Тип подразделения" }));
  await user.click(screen.getByRole("option", { name: "Город" }));
  await user.type(
    screen.getByLabelText("Ссылка для перехода"),
    "https://example.org/reutov",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Сохранить подразделение" }),
  );
  expect(screen.getByLabelText("Название подразделения")).toHaveValue("Реутов");
  await user.click(
    screen.getByRole("button", { name: "Сохранить подразделение" }),
  );
  expect(onSave).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: "Реутов",
      region: "Московская область",
      type: "city",
      url: "https://example.org/reutov",
      published: true,
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Название подразделения"),
    ).not.toBeInTheDocument(),
  );
});

it("confirms reversible removal, supports cancellation and retry, restores archived contacts and respects pending state", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue({});
  const onArchive = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({});
  const row: DivisionLink = {
    id: "vao",
    name: "ВАО",
    url: "",
    region: "Москва",
    type: "district",
    published: true,
    coordinator: "Иван",
  };
  const { rerender } = render(
    <DivisionEditor
      links={[row]}
      pending={false}
      onSave={onSave}
      onArchive={onArchive}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Редактировать подразделение ВАО" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Убрать подразделение" }),
  );
  await user.click(screen.getByRole("button", { name: "Отмена" }));
  expect(onArchive).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Убрать подразделение" }),
  );
  await user.click(screen.getByRole("button", { name: "Убрать в архив" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Убрать в архив" }));
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(onArchive).toHaveBeenLastCalledWith("vao", true);
  rerender(
    <DivisionEditor
      links={[{ ...row, archived: true, published: false }]}
      pending={false}
      onSave={onSave}
      onArchive={onArchive}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Редактировать подразделение ВАО" }),
  );
  expect(screen.getByLabelText("Координатор")).toBeDisabled();
  expect(screen.getByLabelText("Координатор")).toHaveValue("Иван");
  onArchive.mockRejectedValueOnce(new Error("offline"));
  await user.click(
    screen.getByRole("button", { name: "Восстановить как черновик" }),
  );
  expect(screen.getByText(/Подразделение в архиве/)).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Восстановить как черновик" }),
  );
  await waitFor(() => expect(onArchive).toHaveBeenLastCalledWith("vao", false));
  await user.click(screen.getByRole("button", { name: "Архив подразделений" }));
  await user.type(
    screen.getByRole("textbox", { name: "Найти подразделение" }),
    "нет",
  );
  expect(screen.getByText("Подразделение не найдено.")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Действующие подразделения" }),
  );
  rerender(
    <DivisionEditor
      links={[
        row,
        {
          id: "new",
          name: "Новый",
          url: "https://example.org",
          published: false,
        },
      ]}
      pending={true}
      onSave={onSave}
      onArchive={onArchive}
    />,
  );
  expect(screen.getByRole("button", { name: "Добавить" })).toBeDisabled();
});
