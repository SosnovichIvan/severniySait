import { useState, type FormEvent, type ReactNode } from "react";
import { PenLine, Plus, Trash2 } from "lucide-react";
import { EditorDialog } from "../../../shared/ui/editor-dialog";
import type { ChannelRecord } from "../../../../contracts/content";
const blank = { name: "", note: "", short: "", url: "", published: false };
type Props = {
  channels: ChannelRecord[];
  notice?: ReactNode;
  pending: boolean;
  onSave: (
    channel: Omit<ChannelRecord, "id"> & { id?: string },
  ) => Promise<unknown>;
  onPublication: (channel: ChannelRecord) => Promise<unknown>;
  onDelete: (id: string) => void;
};
export function ChannelEditor({
  channels,
  pending,
  onSave,
  onPublication,
  onDelete,
  notice,
}: Props) {
  const [draft, setDraft] = useState<
    (Omit<ChannelRecord, "id"> & { id?: string }) | null
  >(null);
  function addChannel() {
    setDraft({ ...blank });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave(draft!);
      setDraft(null);
    } catch {
      /* The parent keeps the error notice; retain form input for retry. */
    }
  }
  return (
    <div className="admin-collection">
      {!draft && notice}
      <section className="panel">
        <div className="channel-editor-heading">
          <h2>Площадки и каналы</h2>
          <button
            className="button primary add-entity"
            aria-label="Добавить площадку"
            title="Добавить площадку"
            type="button"
            disabled={pending}
            onClick={addChannel}
          >
            <Plus size={18} />
          </button>
        </div>
        <p>Опубликованные ссылки появятся в футере и медиапространстве.</p>
        <div className="admin-card-grid">
          {channels.map((channel) => (
            <article className="admin-row" key={channel.id}>
              <span className="publication">
                {channel.published ? "Опубликовано" : "Черновик"}
              </span>
              <h3>{channel.name}</h3>
              <p className="channel-address">{channel.url}</p>
              <div className="row-actions">
                <button
                  disabled={pending}
                  aria-label={`Редактировать ${channel.name}`}
                  onClick={() => setDraft(channel)}
                >
                  <PenLine size={16} /> Редактировать
                </button>
                <button
                  disabled={pending}
                  onClick={async () => {
                    try {
                      await onPublication(channel);
                    } catch {
                      /* Retain the previous status and show the parent notice. */
                    }
                  }}
                >
                  {channel.published ? "Снять с публикации" : "Опубликовать"}
                </button>
                <button
                  disabled={pending}
                  aria-label={`Удалить ${channel.name}`}
                  onClick={() => onDelete(channel.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!channels.length && <p className="empty">Добавьте первую площадку.</p>}
      </section>
      {draft && (
        <EditorDialog
          title={draft.id ? "Редактировать площадку" : "Новая площадка"}
          busy={pending}
          onClose={() => setDraft(null)}
        >
          {notice}
          <form onSubmit={save}>
            <label>
              Название площадки
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Ссылка на площадку
              <input
                required
                type="url"
                maxLength={2000}
                placeholder="https://…"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </label>
            <label>
              Описание площадки
              <textarea
                maxLength={300}
                rows={3}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
            <label>
              Короткое обозначение
              <input
                required
                maxLength={4}
                placeholder="TG"
                value={draft.short}
                onChange={(e) => setDraft({ ...draft, short: e.target.value })}
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
            <button className="button primary" disabled={pending}>
              {pending ? "Сохраняем…" : "Сохранить площадку"}
            </button>
          </form>
        </EditorDialog>
      )}
    </div>
  );
}
