import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, send } from "../../../shared/api";
import { deploymentsSchema } from "../../../../contracts/content";
const statusNames = {
  scheduled: "Запланировано",
  running: "Выполняется",
  succeeded: "Завершено",
  failed: "Ошибка",
  cancelled: "Отменено",
};
export function UpdateEditor({ csrf }: { csrf: string }) {
  const client = useQueryClient();
  const [version, setVersion] = useState("");
  const [time, setTime] = useState("");
  const [notice, setNotice] = useState("");
  const updates = useQuery({
    queryKey: ["deployments"],
    queryFn: async () =>
      deploymentsSchema.parse(await request("/api/admin/deployments")),
    refetchInterval: 5000,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["deployments"] });
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
        "/api/admin/deployments",
        "POST",
        { version, scheduledAt: new Date(`${time}:00+03:00`).toISOString() },
        csrf,
      );
      setNotice("Обновление запланировано.");
    });
  }
  return (
    <section className="updates-editor">
      <div className="section-heading">
        <h2>Обновление сайта</h2>
        {updates.data && (
          <span>
            Текущая версия:{" "}
            {updates.data.currentVersion === "local"
              ? "локальная"
              : updates.data.currentVersion}
          </span>
        )}
      </div>
      <p>
        Публикация материалов не останавливает сайт. Обновление кода может
        вызвать короткий технический перерыв — выберите удобное время по Москве.
        Само назначение обновления сайт не останавливает.
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
          {!updates.data.enabled && (
            <p className="update-local-note">
              Локальный режим: расписание сохраняется, но обновления не
              запускаются. Исполнитель будет подключён на VPS.
            </p>
          )}
          <div className="admin-grid">
            <section className="panel editor">
              <h3>Назначить обновление</h3>
              <form onSubmit={schedule}>
                <label>
                  Версия обновления
                  <input
                    required
                    aria-label="Версия обновления"
                    aria-describedby="update-version-help"
                    maxLength={32}
                    pattern="(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)"
                    placeholder="Например, 0.1.0"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    disabled={mutation.isPending || busy}
                  />
                  <small id="update-version-help">
                    Номер готовой опубликованной версии. Незавершённые изменения
                    сюда не попадают.
                  </small>
                </label>
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
                  disabled={mutation.isPending || busy}
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
                  <h4>Версия {job.version}</h4>
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
                            `/api/admin/deployments/${job.id}`,
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
