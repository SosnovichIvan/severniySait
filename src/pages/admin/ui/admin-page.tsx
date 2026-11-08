import { UpdateEditor } from "./update-editor";
import { ChannelEditor } from "./channel-editor";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DivisionEditor } from "./division-editor";
import { LoginDialog } from "../../../features/editor-login";
import { ConfirmDialog } from "../../../shared/ui/confirm-dialog";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  Link2,
  RefreshCw,
  Image,
  MapPin,
  LogOut,
  Upload,
  Plus,
  PenLine,
  Trash2,
} from "lucide-react";
import { loadContent, loadSession, send, request } from "../../../shared/api";
import type {
  PublicationKind,
  EventRecord,
  MediaRecord,
} from "../../../../contracts/content";
type Draft = {
  id?: string;
  title: string;
  description: string;
  city: string;
  startsAt: string;
  published: boolean;
};
const blank: Draft = {
  title: "",
  description: "",
  city: "",
  startsAt: "",
  published: false,
};
export function AdminPage({ themeToggle }: { themeToggle?: ReactNode }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: loadSession,
    retry: false,
  });
  const content = useQuery({
    queryKey: ["admin-content"],
    queryFn: () => loadContent(true),
    enabled: !!session.data?.admin,
    retry: false,
  });
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("section");
  const tab = ["media", "divisions", "channels", "updates"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "events";
  function setTab(value: string) {
    setParams(value === "events" ? {} : { section: value }, { replace: true });
  }
  const [draft, setDraft] = useState<Draft>(blank);
  const [mediaEdit, setMediaEdit] = useState<MediaRecord | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState("");
  const [deleting, setDeleting] = useState<{ type: string; id: string } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin-content"] });
      void client.invalidateQueries({ queryKey: ["content"] });
    },
    onError: () => setFeedback(""),
  });
  const csrf = session.data?.csrf ?? "";
  async function logout() {
    mutation.mutate(async () => {
      await send("/api/logout", "POST", {}, csrf);
      client.removeQueries({ queryKey: ["admin-content"] });
      client.removeQueries({ queryKey: ["deployments"] });
      navigate("/", { replace: true });
      await client.invalidateQueries({ queryKey: ["session"] });
    });
  }
  function publish(kind: PublicationKind, id: string, published: boolean) {
    return mutation.mutateAsync(async () => {
      await send(
        `/api/admin/${kind}/${encodeURIComponent(id)}/publication`,
        "PATCH",
        { published },
        csrf,
      );
      if (kind === "events" && draft.id === id)
        setDraft((current) => ({ ...current, published }));
      if (kind === "media" && mediaEdit?.id === id)
        setMediaEdit((current) => current && { ...current, published });
      setFeedback(
        published
          ? "Запись опубликована."
          : "Запись снята с публикации и сохранена как черновик.",
      );
    });
  }
  function saveEvent(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(async () => {
      const startsAt = new Date(`${draft.startsAt}:00+03:00`).toISOString();
      await send(
        `/api/admin/events${draft.id ? `/${draft.id}` : ""}`,
        draft.id ? "PUT" : "POST",
        {
          title: draft.title,
          description: draft.description,
          city: draft.city,
          startsAt,
          published: draft.published,
        },
        csrf,
      );
      setDraft(blank);
      setFeedback("Событие сохранено.");
    });
  }
  function saveMedia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    mutation.mutate(async () => {
      if (mediaEdit) {
        await send(
          `/api/admin/media/${mediaEdit.id}`,
          "PUT",
          {
            title: String(form.get("title")),
            description: String(form.get("description")),
            eventDate: String(form.get("eventDate") ?? ""),
            published: form.get("published") === "on",
          },
          csrf,
        );
      } else {
        if (!file) throw new Error("Выберите файл.");
        form.set("file", file);
        form.set("published", String(form.get("published") === "on"));
        await request("/api/admin/media", {
          method: "POST",
          headers: { "x-csrf-token": csrf },
          body: form,
        });
      }
      formElement.reset();
      setMediaEdit(null);
      setFile(null);
      setFeedback("Материал сохранён.");
    });
  }
  function editEvent(event: EventRecord) {
    const date = new Date(event.startsAt);
    setDraft({
      ...event,
      startsAt: new Date(date.getTime() + 3 * 3600000)
        .toISOString()
        .slice(0, 16),
    });
    setFeedback("");
  }
  function addGalleryImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = new FormData(formElement);
    mutation.mutate(async () => {
      await request(`/api/admin/media/${mediaEdit!.id}/images`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body,
      });
      formElement.reset();
      setFeedback("Фотография добавлена в галерею.");
    });
  }
  const notice = (
    <>
      {mutation.error && (
        <p role="alert" className="error">
          {mutation.error.message}
        </p>
      )}
      {feedback && (
        <p role="status" className="success">
          {feedback}
        </p>
      )}
    </>
  );
  if (session.isPending)
    return (
      <main id="main" className="container empty" role="status">
        Проверяем сессию…
      </main>
    );
  if (session.error)
    return (
      <main id="main" className="container empty" role="alert">
        Не удалось проверить вход.{" "}
        <button onClick={() => void session.refetch()}>Повторить</button>
      </main>
    );
  if (!session.data?.admin)
    return (
      <>
        <main id="main" className="container empty">
          <p>Для работы с материалами войдите в редакцию.</p>
        </main>
        <LoginDialog onClose={() => navigate("/")} />
      </>
    );
  return (
    <main id="main" className="container admin">
      <h1 className="sr-only">Управление материалами сайта</h1>
      <div className="admin-toolbar">
        <a
          className="header-brand"
          href="/"
          aria-label="Северный человек — главная"
        >
          <span className="header-brand-name" aria-hidden="true">
            Северный<span>человек</span>
          </span>
          <span className="header-brand-short" aria-hidden="true">
            СЧ
          </span>
        </a>
        <div className="admin-toolbar-actions">
          {themeToggle}
          <button
            className="button"
            disabled={mutation.isPending}
            onClick={() => void logout()}
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </div>
      <div className="tabs">
        <button
          aria-pressed={tab === "events"}
          className={tab === "events" ? "active" : ""}
          onClick={() => {
            setTab("events");
            mutation.reset();
            setFeedback("");
          }}
        >
          <CalendarDays size={16} /> События
        </button>
        <button
          aria-pressed={tab === "media"}
          className={tab === "media" ? "active" : ""}
          onClick={() => {
            setTab("media");
            mutation.reset();
            setFeedback("");
          }}
        >
          <Image size={16} /> Медиа
        </button>
        <button
          aria-pressed={tab === "divisions"}
          className={tab === "divisions" ? "active" : ""}
          onClick={() => {
            setTab("divisions");
            mutation.reset();
            setFeedback("");
          }}
        >
          <MapPin size={16} /> Подразделения
        </button>
        <button
          aria-pressed={tab === "channels"}
          className={tab === "channels" ? "active" : ""}
          onClick={() => {
            setTab("channels");
            mutation.reset();
            setFeedback("");
          }}
        >
          <Link2 size={16} /> Площадки и каналы
        </button>
        <button
          aria-pressed={tab === "updates"}
          className={tab === "updates" ? "active" : ""}
          onClick={() => {
            setTab("updates");
            mutation.reset();
            setFeedback("");
          }}
        >
          <RefreshCw size={16} /> Обновление сайта
        </button>
      </div>
      {notice}
      {tab === "updates" ? (
        <UpdateEditor csrf={csrf} />
      ) : tab === "channels" ? (
        <>
          {content.isPending && <p role="status">Загружаем площадки…</p>}
          {content.error && (
            <p role="alert">
              Не удалось загрузить площадки.{" "}
              <button onClick={() => void content.refetch()}>Повторить</button>
            </p>
          )}
          {content.data && (
            <ChannelEditor
              key={content.data.channels?.length ?? 0}
              channels={content.data.channels ?? []}
              pending={mutation.isPending}
              onSave={(channel) =>
                mutation.mutateAsync(async () => {
                  await send(
                    `/api/admin/channels${channel.id ? `/${channel.id}` : ""}`,
                    channel.id ? "PUT" : "POST",
                    channel,
                    csrf,
                  );
                  setFeedback("Площадка сохранена.");
                })
              }
              onPublication={(channel) =>
                publish("channels", channel.id, !channel.published)
              }
              onDelete={(id) => setDeleting({ type: "channels", id })}
            />
          )}
        </>
      ) : tab === "divisions" ? (
        <>
          {content.isPending && <p role="status">Загружаем подразделения…</p>}
          {content.error && (
            <p role="alert">
              Не удалось загрузить подразделения.{" "}
              <button onClick={() => void content.refetch()}>Повторить</button>
            </p>
          )}
          {content.data && (
            <DivisionEditor
              links={content.data.divisions ?? []}
              pending={mutation.isPending}
              onSave={(link) =>
                mutation.mutate(async () => {
                  await send("/api/admin/divisions", "PUT", link, csrf);
                  setFeedback("Данные подразделения сохранены.");
                })
              }
            />
          )}
        </>
      ) : (
        <div className="admin-grid">
          <section className="panel">
            <div className="section-heading">
              <h2>{tab === "events" ? "События" : "Медиатека"}</h2>
              <span className="eyebrow">
                {tab === "events"
                  ? content.data?.events.length
                  : content.data?.media.length}
              </span>
            </div>
            {content.isPending && <p role="status">Загружаем…</p>}
            {content.error && (
              <p role="alert">
                Не удалось загрузить список.{" "}
                <button onClick={() => void content.refetch()}>
                  Повторить
                </button>
              </p>
            )}
            {(tab === "events"
              ? content.data?.events
              : content.data?.media
            )?.map((item) => (
              <article className="admin-row" key={item.id}>
                <span className="publication">
                  {item.published ? "Опубликовано" : "Черновик"}
                </span>
                <h3>{item.title}</h3>
                <p>
                  {"city" in item
                    ? item.city
                    : item.kind === "video"
                      ? "Видео"
                      : "Изображение"}
                </p>
                <div className="row-actions">
                  <button
                    aria-label={`Редактировать ${item.title}`}
                    disabled={mutation.isPending}
                    onClick={() => {
                      if ("city" in item) {
                        editEvent(item);
                      } else {
                        setMediaEdit(item);
                      }
                    }}
                  >
                    <PenLine size={16} /> Редактировать
                  </button>
                  <button
                    disabled={mutation.isPending}
                    onClick={() =>
                      void publish(
                        "city" in item ? "events" : "media",
                        item.id,
                        !item.published,
                      ).catch(() => {})
                    }
                  >
                    {item.published ? "Снять с публикации" : "Опубликовать"}
                  </button>
                  <button
                    aria-label={`Удалить ${item.title}`}
                    disabled={mutation.isPending}
                    onClick={() => setDeleting({ type: tab, id: item.id })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {content.data &&
              (tab === "events" ? content.data.events : content.data.media)
                .length === 0 && (
                <p className="empty">
                  Пока ничего нет. Добавьте{" "}
                  {tab === "events" ? "первое событие" : "первый материал"}.
                </p>
              )}
          </section>
          <section className="panel editor">
            <h2>
              {tab === "events"
                ? draft.id
                  ? "Редактировать событие"
                  : "Новое событие"
                : mediaEdit
                  ? "Редактировать материал"
                  : "Загрузить медиа"}
            </h2>
            {tab === "events" ? (
              <form onSubmit={saveEvent}>
                <label>
                  Название события
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Город
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={draft.city}
                    onChange={(e) =>
                      setDraft({ ...draft, city: e.target.value })
                    }
                  />
                </label>
                <label>
                  Дата и время (МСК)
                  <input
                    type="datetime-local"
                    required
                    value={draft.startsAt}
                    onChange={(e) =>
                      setDraft({ ...draft, startsAt: e.target.value })
                    }
                  />
                </label>
                <label>
                  Описание
                  <textarea
                    maxLength={4000}
                    rows={4}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={(e) =>
                      setDraft({ ...draft, published: e.target.checked })
                    }
                  />{" "}
                  Опубликовать на сайте
                </label>
                <button
                  className="button primary"
                  disabled={mutation.isPending}
                >
                  <Plus size={16} />
                  {mutation.isPending ? "Сохраняем…" : "Сохранить событие"}
                </button>
                {draft.id && (
                  <button
                    className="button"
                    type="button"
                    onClick={() => setDraft(blank)}
                  >
                    Отменить редактирование
                  </button>
                )}
              </form>
            ) : (
              <form key={mediaEdit?.id ?? "new"} onSubmit={saveMedia}>
                <label>
                  Название материала
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={160}
                    defaultValue={mediaEdit?.title}
                  />
                </label>
                <label>
                  Дата материала
                  <input
                    type="date"
                    name="eventDate"
                    defaultValue={mediaEdit?.eventDate ?? ""}
                  />
                  <small>
                    Дата события, а для архивной публикации — её дата. Можно
                    оставить пустой, если дата неизвестна.
                  </small>
                </label>
                <label>
                  Описание
                  <textarea
                    name="description"
                    rows={4}
                    maxLength={4000}
                    defaultValue={mediaEdit?.description}
                  />
                </label>
                {!mediaEdit && (
                  <label className="upload-zone">
                    <Upload />
                    <span>{file?.name ?? "Выбрать фото или видео"}</span>
                    <small>PNG, JPEG, WebP, MP4 · до 30 МБ</small>
                    <input
                      aria-label="Файл медиа"
                      type="file"
                      name="file"
                      accept="image/png,image/jpeg,image/webp,video/mp4"
                      required={!file}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    name="published"
                    key={String(mediaEdit?.published)}
                    defaultChecked={mediaEdit?.published ?? false}
                  />{" "}
                  Опубликовать на сайте
                </label>
                <button
                  className="button primary"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Сохраняем…" : "Сохранить материал"}
                </button>
                {mediaEdit && (
                  <button
                    className="button"
                    type="button"
                    onClick={() => setMediaEdit(null)}
                  >
                    Отменить редактирование
                  </button>
                )}
              </form>
            )}
            {tab === "media" && mediaEdit && (
              <section className="editor-gallery">
                <h2>Фотографии события</h2>
                <p>
                  Обложка сохраняется отдельно. В галерею можно добавить до 30
                  фотографий.
                </p>
                <ul>
                  {(
                    content.data?.media.find((item) => item.id === mediaEdit.id)
                      ?.images ?? []
                  ).map((image, index) => (
                    <li key={image.id}>
                      <img src={image.url} alt={`Фотография ${index + 1}`} />
                      <button
                        type="button"
                        className="button danger"
                        disabled={mutation.isPending}
                        aria-label={`Удалить фотографию ${index + 1}`}
                        onClick={() =>
                          mutation.mutate(async () => {
                            await send(
                              `/api/admin/media/${mediaEdit.id}/images/${image.id}`,
                              "DELETE",
                              {},
                              csrf,
                            );
                            setFeedback("Фотография удалена.");
                          })
                        }
                      >
                        <Trash2 size={16} /> Удалить
                      </button>
                    </li>
                  ))}
                </ul>
                <form onSubmit={addGalleryImage}>
                  <label>
                    Фотография для галереи
                    <input
                      type="file"
                      name="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                    />
                  </label>
                  <button className="button" disabled={mutation.isPending}>
                    Добавить фотографию
                  </button>
                </form>
              </section>
            )}
          </section>
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          busy={mutation.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            mutation.mutate(async () => {
              await send(
                `/api/admin/${deleting.type}/${deleting.id}`,
                "DELETE",
                {},
                csrf,
              );
              setDeleting(null);
              setDraft(blank);
              setMediaEdit(null);
              setFeedback("Запись удалена.");
            })
          }
        />
      )}
    </main>
  );
}
