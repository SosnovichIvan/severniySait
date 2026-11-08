import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, send } from "../../../shared/api";
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
  const [selected, setSelected] = useState<string[]>([]);
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
  function schedule(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending) return;
    mutation.mutate(async () => {
      await send(
        "/api/admin/content-updates",
        "POST",
        {
          scheduledAt: new Date(`${time}:00+03:00`).toISOString(),
          targets: updates
            .data!.drafts.filter((item) =>
              selected.includes(`${item.kind}:${item.id}`),
            )
            .map(({ kind, id }) => ({ kind, id })),
        },
        csrf,
      );
      setNotice("Обновление запланировано.");
    });
  }
  return (
    <section className="updates-editor">
      <div className="section-heading">
        <h2>Обновление сайта</h2>
      </div>
      <p>
        Сохраните материалы как черновики, выберите их ниже и назначьте время
        публикации по Москве. Сайт продолжит работать; код и версия приложения
        не изменятся. Изменение выбранного черновика отменит его выполнение —
        потребуется назначить публикацию заново.
      </p>
      {updates.isPending && <p role="status">Загружаем расписание…</p>}
      {updates.error && (
        <p role="alert">
          Не удалось загрузить расписание.{" "}
          <button onClick={() => void updates.refetch()}>Повторить</button>
        </p>
      )}
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
      {updates.data && (
        <>
          <div className="admin-grid">
            <section className="panel editor">
              <h3>Назначить обновление</h3>
              <form onSubmit={schedule}>
                <fieldset
                  className="update-targets"
                  disabled={mutation.isPending || busy}
                >
                  <legend>Черновики для публикации</legend>
                  {!updates.data.drafts.length && (
                    <p>
                      Нет черновиков. Сначала сохраните материал без публикации.
                    </p>
                  )}
                  {updates.data.drafts.map((item) => {
                    const key = `${item.kind}:${item.id}`;
                    return (
                      <label className="check" key={key}>
                        <input
                          type="checkbox"
                          checked={selected.includes(key)}
                          onChange={(event) =>
                            setSelected((values) =>
                              event.target.checked
                                ? [...values, key]
                                : values.filter((value) => value !== key),
                            )
                          }
                        />
                        <span>{item.title}</span>
                      </label>
                    );
                  })}
                </fieldset>
                <label>
                  Дата и время обновления (МСК)
                  <input
                    required
                    type="datetime-local"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    disabled={mutation.isPending || busy}
                  />
                </label>
                <button
                  className="button primary"
                  disabled={
                    mutation.isPending ||
                    busy ||
                    !selected.some((key) =>
                      updates.data.drafts.some(
                        (item) => key === `${item.kind}:${item.id}`,
                      ),
                    )
                  }
                >
                  {mutation.isPending
                    ? "Сохраняем…"
                    : "Запланировать обновление"}
                </button>
                {busy && (
                  <p>Сначала отмените или дождитесь текущего обновления.</p>
                )}
              </form>
            </section>
            <section className="panel">
              <h3>Расписание и результаты</h3>
              {!updates.data.jobs.length && (
                <p className="empty">Обновления пока не назначены.</p>
              )}
              {updates.data.jobs.map((job) => (
                <article className="admin-row" key={job.id}>
                  <span className="publication">{statusNames[job.status]}</span>
                  <h4>Материалов: {job.count}</h4>
                  <p>
                    {new Intl.DateTimeFormat("ru-RU", {
                      dateStyle: "long",
                      timeStyle: "short",
                      timeZone: "Europe/Moscow",
                    }).format(new Date(job.scheduledAt))}{" "}
                    МСК
                  </p>
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
            </section>
          </div>
        </>
      )}
    </section>
  );
}
