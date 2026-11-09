import { useState, type FormEvent } from "react";
import { MapPin, Search, Plus, Archive, RotateCcw } from "lucide-react";
import { Select } from "../../../shared/ui/select";
import { ConfirmDialog } from "../../../shared/ui/confirm-dialog";
import type { DivisionLink } from "../../../../contracts/content";

type Props = {
  links: DivisionLink[];
  pending: boolean;
  onSave: (link: DivisionLink) => Promise<unknown>;
  onArchive: (id: string, archived: boolean) => Promise<unknown>;
};
const fields = [
  ["coordinator", "Координатор", "text", 120],
  ["contact", "Контакт для связи", "text", 300],
  ["vk", "Ссылка на ВК", "url", 2000],
  ["max", "Ссылка на MAX", "url", 2000],
  ["telegram", "Ссылка на Telegram", "url", 2000],
  ["email", "Электронная почта", "email", 254],
  ["website", "Ссылка на сайт", "url", 2000],
] as const;
export function DivisionEditor({ links, pending, onSave, onArchive }: Props) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DivisionLink | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const filtered = links.filter(
    (d) =>
      !!d.archived === showArchive &&
      d.name.toLowerCase().includes(search.toLowerCase()),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave(draft!);
      setDraft(null);
    } catch {
      /* Error remains in parent mutation feedback. */
    }
  }
  async function archive(archived: boolean) {
    try {
      await onArchive(draft!.id!, archived);
      setArchiving(false);
      setDraft(null);
      setShowArchive(archived);
    } catch {
      /* Keep the form and confirmation available for retry. */
    }
  }
  return (
    <div className="admin-grid division-editor">
      <section className="panel">
        <div className="section-heading">
          <h2>Подразделения</h2>
          <button
            type="button"
            className="button primary"
            disabled={pending}
            onClick={() =>
              setDraft({
                name: "",
                url: "",
                published: false,
                region: "Москва",
                type: "district",
              })
            }
          >
            <Plus size={18} />
            Добавить
          </button>
        </div>
        <button
          type="button"
          className="button"
          disabled={pending}
          aria-pressed={showArchive}
          onClick={() => {
            setShowArchive(!showArchive);
            setDraft(null);
          }}
        >
          {showArchive ? "Действующие подразделения" : "Архив подразделений"}
        </button>
        <label className="search-box">
          <Search size={20} />
          <input
            aria-label="Найти подразделение"
            placeholder="Найти округ или город"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>{filtered.length}</span>
        </label>
        <div className="division-editor-list">
          {filtered.map((saved) => (
            <button
              type="button"
              className="button"
              key={saved.id ?? saved.name}
              disabled={pending}
              aria-label={`Редактировать подразделение ${saved.name}`}
              aria-pressed={draft?.name === saved.name}
              onClick={() => setDraft({ ...saved })}
            >
              <MapPin size={16} />
              <span>{saved.name}</span>
              <small>
                {saved.archived
                  ? "В архиве"
                  : saved.published
                    ? "Опубликовано"
                    : "Черновик"}{" "}
                · {saved.url ? "Ссылка добавлена" : "Нет ссылки"}
              </small>
            </button>
          ))}
        </div>
        {!filtered.length && <p className="empty">Подразделение не найдено.</p>}
      </section>
      <section className="panel editor">
        <h2>{draft?.name || "Новое подразделение"}</h2>
        {draft ? (
          <form onSubmit={(event) => void save(event)}>
            <fieldset
              disabled={pending || draft.archived}
              className="division-details"
            >
              <label>
                Название подразделения
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <Select
                label="Регион"
                value={draft.region ?? "Москва"}
                disabled={pending || draft.archived}
                options={[
                  { value: "Москва", label: "Москва" },
                  { value: "Московская область", label: "Московская область" },
                ]}
                onChange={(region) =>
                  setDraft({
                    ...draft,
                    region: region as DivisionLink["region"],
                  })
                }
              />
              <Select
                label="Тип подразделения"
                value={draft.type ?? "city"}
                disabled={pending || draft.archived}
                options={[
                  { value: "district", label: "Округ Москвы" },
                  { value: "city", label: "Город" },
                ]}
                onChange={(type) =>
                  setDraft({ ...draft, type: type as DivisionLink["type"] })
                }
              />
              <label>
                Ссылка для перехода
                <input
                  type="url"
                  name="divisionUrl"
                  maxLength={2000}
                  placeholder="https://…"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                />
              </label>
              <p>
                Пустая ссылка оставляет опубликованную карточку видимой, но
                отключает переход.
              </p>
              <fieldset className="division-contact-fields">
                <legend>Дополнительная информация · необязательно</legend>
                {fields.map(([name, label, type, max]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type={type}
                      maxLength={max}
                      value={draft[name] ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [name]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </fieldset>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.published ?? false}
                  onChange={(e) =>
                    setDraft({ ...draft, published: e.target.checked })
                  }
                />
                Опубликовать на сайте
              </label>
              <p>
                Черновик целиком скрыт от посетителей. Контакты сохраняются при
                снятии с публикации.
              </p>
              <button className="button primary" disabled={pending}>
                {pending ? "Сохраняем…" : "Сохранить подразделение"}
              </button>
            </fieldset>
            {draft.archived && (
              <p>
                Подразделение в архиве. Восстановите его как черновик, чтобы
                редактировать.
              </p>
            )}
            {draft.id &&
              (draft.archived ? (
                <button
                  type="button"
                  className="button"
                  disabled={pending}
                  onClick={() => void archive(false)}
                >
                  <RotateCcw size={17} />
                  Восстановить как черновик
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  disabled={pending}
                  onClick={() => setArchiving(true)}
                >
                  <Archive size={17} />
                  Убрать подразделение
                </button>
              ))}
          </form>
        ) : (
          <p>
            Выберите подразделение или добавьте новое. Здесь можно управлять
            округами Москвы и городами Подмосковья.
          </p>
        )}
      </section>
      {archiving && (
        <ConfirmDialog
          busy={pending}
          title="Убрать подразделение?"
          description="Карточка исчезнет с сайта. Контакты сохранятся в архиве; подразделение можно будет восстановить."
          confirmLabel="Убрать в архив"
          onCancel={() => setArchiving(false)}
          onConfirm={() => void archive(true)}
        />
      )}
    </div>
  );
}
