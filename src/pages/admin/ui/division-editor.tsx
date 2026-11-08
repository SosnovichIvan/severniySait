import { useState, type FormEvent } from "react";
import { MapPin, Search } from "lucide-react";
import { divisions } from "../../../shared/api";
import type { DivisionLink } from "../../../../contracts/content";

type Props = {
  links: DivisionLink[];
  pending: boolean;
  onSave: (link: DivisionLink) => void;
};
export function DivisionEditor({ links, pending, onSave }: Props) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DivisionLink | null>(null);
  const filtered = divisions.filter((division) =>
    division.name.toLowerCase().includes(search.toLowerCase()),
  );
  function save(event: FormEvent) {
    event.preventDefault();
    onSave(draft!);
  }
  return (
    <div className="admin-grid division-editor">
      <section className="panel">
        <h2>Подразделения</h2>
        <label className="search-box">
          <Search size={20} />
          <input
            aria-label="Найти подразделение"
            placeholder="Найти город"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span>{filtered.length}</span>
        </label>
        <div className="division-editor-list">
          {filtered.map(({ name }) => {
            const url = links.find((link) => link.name === name)?.url ?? "";
            return (
              <button
                type="button"
                className="button"
                key={name}
                disabled={pending}
                aria-label={`Редактировать подразделение ${name}`}
                aria-pressed={draft?.name === name}
                onClick={() =>
                  setDraft({
                    ...links.find((link) => link.name === name),
                    name,
                    url,
                  })
                }
              >
                <MapPin size={16} />
                <span>{name}</span>
                <small>{url ? "Ссылка добавлена" : "Нет ссылки"}</small>
              </button>
            );
          })}
        </div>
        {!filtered.length && <p className="empty">Город не найден.</p>}
      </section>
      <section className="panel editor">
        <h2>{draft?.name ?? "Ссылка подразделения"}</h2>
        {draft ? (
          <form onSubmit={save}>
            <label>
              Ссылка для перехода
              <input
                type="url"
                name="divisionUrl"
                maxLength={2000}
                placeholder="https://…"
                value={draft.url}
                onChange={(event) =>
                  setDraft({ ...draft, url: event.target.value })
                }
                disabled={pending}
              />
            </label>
            <p>
              Добавьте адрес карточки подразделения или региональной площадки.
              Пустое поле отключает переход на сайте.
            </p>
            <fieldset className="division-contact-fields" disabled={pending}>
              <legend>Дополнительная информация · необязательно</legend>
              <label>
                Координатор
                <input
                  name="coordinator"
                  type="text"
                  maxLength={120}
                  placeholder="Имя и фамилия"
                  value={draft.coordinator ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, coordinator: event.target.value })
                  }
                />
              </label>
              <label>
                Контакт для связи
                <input
                  name="contact"
                  type="text"
                  maxLength={300}
                  placeholder="Телефон, имя пользователя или другой контакт"
                  value={draft.contact ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, contact: event.target.value })
                  }
                />
              </label>
              <label>
                Ссылка на ВК
                <input
                  name="vk"
                  type="url"
                  maxLength={2000}
                  placeholder="https://vk.com/…"
                  value={draft.vk ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, vk: event.target.value })
                  }
                />
              </label>
              <label>
                Ссылка на MAX
                <input
                  name="max"
                  type="url"
                  maxLength={2000}
                  placeholder="https://max.ru/…"
                  value={draft.max ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, max: event.target.value })
                  }
                />
              </label>
              <label>
                Ссылка на Telegram
                <input
                  name="telegram"
                  type="url"
                  maxLength={2000}
                  placeholder="https://t.me/…"
                  value={draft.telegram ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, telegram: event.target.value })
                  }
                />
              </label>
              <label>
                Электронная почта
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  placeholder="name@example.ru"
                  value={draft.email ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </label>
              <label>
                Ссылка на сайт
                <input
                  name="website"
                  type="url"
                  maxLength={2000}
                  placeholder="https://…"
                  value={draft.website ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, website: event.target.value })
                  }
                />
              </label>
            </fieldset>
            <button className="button primary" disabled={pending}>
              {pending ? "Сохраняем…" : "Сохранить подразделение"}
            </button>
          </form>
        ) : (
          <p>Выберите город слева, чтобы добавить или изменить ссылку.</p>
        )}
      </section>
    </div>
  );
}
