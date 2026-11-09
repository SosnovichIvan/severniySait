import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, send } from "../../../shared/api";
import { EditorDialog } from "../../../shared/ui/editor-dialog";
import { contentUpdatesSchema } from "../../../../contracts/content";
const statusNames = {
  scheduled: "Запланировано",
  running: "Выполняется",
  succeeded: "Завершено",
  failed: "Ошибка",
  cancelled: "Отменено",
};
export function UpdateEditor({ csrf }: { csrf: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [notice, setNotice] = useState("");
  const updates = useQuery({
    queryKey: ["content-updates"],
    queryFn: async () =>
      contentUpdatesSchema.parse(await request("/api/admin/content-updates")),
    refetchInterval: 5000,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["content-updates"] });
    },
    onError: () => setNotice(""),
  });
  const busy = updates.data?.jobs.some(
    (job) => job.status === "scheduled" || job.status === "running",
  );
  const feedback = (
    <>
      {mutation.error && (
        <p role="alert" className="error">
          {mutation.error.message}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
    </>
  );
  function schedule(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(async () => {
      await send(
        "/api/admin/content-updates",
        "POST",
        { scheduledAt: new Date(`${time}:00+03:00`).toISOString() },
        csrf,
      );
      setOpen(false);
      setNotice("Обновление запланировано.");
    });
  }
  return (
    <section className="updates-editor admin-collection">
      <div className="section-heading">
        <h2>Обновление сайта</h2>
        <button
          type="button"
          className="button primary add-entity"
          aria-label="Назначить обновление"
          title="Назначить обновление"
          disabled={!updates.data || busy || mutation.isPending}
          onClick={() => {
            mutation.reset();
            setNotice("");
            setTime("");
            setOpen(true);
          }}
        >
          <Plus size={18} />
        </button>
      </div>
      <p>
        Опубликованные записи обновляются сразу. По расписанию публикуются все
        новые и изменённые черновики, сохранённые к назначенному времени.
        Выбирать записи не нужно. Архив и ранее скрытые материалы автоматически
        не возвращаются на сайт; код приложения не меняется.
      </p>
      {updates.isPending && <p role="status">Загружаем расписание…</p>}
      {updates.error && (
        <p role="alert">
          Не удалось загрузить расписание.{" "}
          <button onClick={() => void updates.refetch()}>Повторить</button>
        </p>
      )}
      {!open && feedback}
      {updates.data && (
        <section className="panel">
          <h3>Расписание и результаты</h3>
          {!updates.data.jobs.length && (
            <p className="empty">Обновления пока не назначены.</p>
          )}
          <div className="admin-card-grid">
            {updates.data.jobs.map((job) => (
              <article className="admin-row" key={job.id}>
                <span className="publication">{statusNames[job.status]}</span>
                <h4>
                  {new Intl.DateTimeFormat("ru-RU", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Europe/Moscow",
                  }).format(new Date(job.scheduledAt))}{" "}
                  МСК
                </h4>
                {job.detail && <p>{job.detail}</p>}
                {job.status === "scheduled" && (
                  <button
                    className="button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate(async () => {
                        await send(
                          `/api/admin/content-updates/${job.id}`,
                          "DELETE",
                          {},
                          csrf,
                        );
                        setNotice("Обновление отменено.");
                      })
                    }
                  >
                    Отменить обновление
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {open && (
        <EditorDialog
          title="Назначить обновление"
          busy={mutation.isPending}
          onClose={() => {
            setOpen(false);
            mutation.reset();
          }}
        >
          {feedback}
          <form onSubmit={schedule}>
            <p>
              В указанное время будут опубликованы все ожидающие изменения.
              Новые сохранённые черновики также войдут в это обновление.
            </p>
            {!updates.data?.drafts.length && (
              <p>
                Нет ожидающих изменений. Сохраните новый или изменённый
                черновик.
              </p>
            )}
            <label>
              Дата и время обновления (МСК)
              <input
                required
                type="datetime-local"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={mutation.isPending || !updates.data?.drafts.length}
            >
              {mutation.isPending ? "Сохраняем…" : "Запланировать обновление"}
            </button>
          </form>
        </EditorDialog>
      )}
    </section>
  );
}
