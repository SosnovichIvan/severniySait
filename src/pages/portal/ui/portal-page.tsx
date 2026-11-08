import { Select } from "../../../shared/ui/select";
import type { MediaRecord } from "../../../../contracts/content";
import { channels } from "../../../shared/config/channels";
import { sortMedia } from "../../../shared/lib/media-chronology";
import {
  getMoscowDate,
  useMoscowToday,
} from "../../../shared/lib/calendar-date";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Search,
  MapPin,
  Image,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Handshake,
  Package,
} from "lucide-react";
import { loadContent, divisions } from "../../../shared/api";

export function PortalPage() {
  const path = useLocation().pathname;
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["content"],
    queryFn: () => loadContent(),
  });
  const [search, setSearch] = useState("");
  const [mediaType, setMediaType] = useState("all");
  const [mediaYear, setMediaYear] = useState("all");
  const [mediaOrder, setMediaOrder] = useState<"asc" | "desc">("asc");
  const mediaYears = [
    ...new Set(
      data?.media.flatMap((m) =>
        m.eventDate ? [m.eventDate.slice(0, 4)] : [],
      ),
    ),
  ].sort();
  const archiveMedia = sortMedia(
    (data?.media ?? []).filter(
      (m) =>
        (mediaType === "all" || m.kind === mediaType) &&
        (mediaYear === "all" || m.eventDate?.startsWith(mediaYear)),
    ),
    mediaOrder,
  );
  const today = useMoscowToday();
  const [month, setMonth] = useState(
    () => new Date(today.year, today.month, 1),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(today.day);
  const isHome = path === "/";
  const title =
    path === "/media"
      ? "Медиа"
      : path === "/divisions"
        ? "Подразделения"
        : path === "/calendar"
          ? "Календарь событий"
          : "Медиапространство";
  const filtered = divisions.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );
  const monthEvents =
    data?.events.filter((e) => {
      const d = getMoscowDate(new Date(e.startsAt));
      return d.year === month.getFullYear() && d.month === month.getMonth();
    }) ?? [];
  const events = monthEvents.filter(
    (e) =>
      !selectedDay || getMoscowDate(new Date(e.startsAt)).day === selectedDay,
  );
  const status = (
    <>
      {isPending && (
        <p role="status" className="empty">
          Загружаем материалы…
        </p>
      )}
      {error && (
        <div role="alert" className="empty">
          Не удалось загрузить материалы.{" "}
          <button onClick={() => void refetch()}>Повторить</button>
        </div>
      )}
    </>
  );
  return (
    <main id="main" className="container">
      {isHome ? (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="hero-heading">
                <h1 aria-label="Северный человек">
                  Северный <span>человек</span>
                </h1>
                <img
                  className="brand-logo"
                  src="/logo.png"
                  width="240"
                  height="240"
                  alt="Логотип объединения «Северный человек»"
                />
              </div>
              <p className="hero-statement">
                Наша сила — в единстве. Сохраняем русские традиции, развиваем
                спорт, воспитываем молодёжь, укрепляем устои общества и
                поддерживаем граждан.
              </p>
            </div>
            <section className="hero-about" aria-labelledby="about-title">
              <p className="eyebrow">ОБ ОБЪЕДИНЕНИИ</p>
              <h2 id="about-title">Чем занимается «Северный человек»</h2>
              <p className="about-intro">
                Объединение основано в 2022 году и работает через региональные
                подразделения. Основные направления, заявленные на его сайте:
              </p>
              <dl className="activity-list">
                <div>
                  <dt>
                    <span aria-hidden="true">
                      <BookOpen />
                    </span>
                    Культура и просвещение
                  </dt>
                  <dd>
                    Сохранение культурных традиций и воспитательные проекты для
                    молодёжи и взрослых.
                  </dd>
                </div>
                <div>
                  <dt>
                    <span aria-hidden="true">
                      <Handshake />
                    </span>
                    Социальные проекты
                  </dt>
                  <dd>
                    Разработка и реализация общественных инициатив в рамках
                    устава объединения.
                  </dd>
                </div>
                <div>
                  <dt>
                    <span aria-hidden="true">
                      <Package />
                    </span>
                    Помощь военнослужащим
                  </dt>
                  <dd>
                    Отдельное направление с 2022 года — поддержка военнослужащих
                    и добровольцев СВО.
                  </dd>
                </div>
              </dl>
            </section>
          </section>
          <section
            className="founder-section"
            id="founder"
            aria-labelledby="founder-title"
          >
            <div className="founder-profile">
              <figure className="founder-portrait">
                <img
                  src="/mikhail-mavashi.jpg"
                  alt="Портрет Михаила Маваши"
                  width="320"
                  height="320"
                  loading="lazy"
                />
                <figcaption>
                  Фото из{" "}
                  <a
                    href="https://t.me/mikhailmavashi"
                    target="_blank"
                    rel="noreferrer"
                  >
                    официального Telegram-канала <ArrowUpRight size={12} />
                  </a>
                </figcaption>
              </figure>
              <div className="founder-identity">
                <p className="eyebrow">ОСНОВАТЕЛЬ ОБЪЕДИНЕНИЯ</p>
                <h2 id="founder-title" aria-label="Михаил Маваши">
                  Михаил
                  <br />
                  <span>Маваши</span>
                </h2>
                <p className="founder-fullname">Михаил Фёдорович Ниц</p>
                <p className="founder-role">
                  Музыкант, автор песен и основатель «Северного человека».
                </p>
              </div>
            </div>
            <div className="founder-story">
              <h3>От музыки — к объединению</h3>
              <p>
                Михаил Маваши родился в 1985 году в Кустанае, в Казахской ССР. В
                юности занимался единоборствами, получил юридическое образование
                в Челябинске. Псевдоним «Маваши» связан с названием кругового
                удара ногой в боевых искусствах.
              </p>
              <p>
                Музыкальную карьеру начал в конце 2000-х. В его песнях
                появлялись темы спорта, личной дисциплины и повседневной жизни.
                Позднее он перешёл от сольного рэпа к работе с рок-коллективом
                «МАВАШИ group».
              </p>
              <ol className="founder-timeline">
                <li>
                  <span>2009</span>
                  <p>Первый альбом — «Только правда».</p>
                </li>
                <li>
                  <span>2018</span>
                  <p>Создание музыкального коллектива «МАВАШИ group».</p>
                </li>
                <li>
                  <span>2022</span>
                  <p>Основание объединения «Северный человек».</p>
                </li>
              </ol>
              <p className="biography-sources">
                Источники:{" "}
                <a
                  href="https://www.rbc.ru/person/6addccc77ed5c3f0602233c7"
                  target="_blank"
                  rel="noreferrer"
                >
                  биография РБК <ArrowUpRight size={12} />
                </a>
              </p>
            </div>
          </section>
          <section className="section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">РЕДАКЦИЯ ПОРТАЛА</p>
                <h2>Последние материалы</h2>
              </div>
              <Link className="text-link" to="/media">
                Все медиа <ArrowUpRight size={18} />
              </Link>
            </div>
            {status}
            {data && data.media.length === 0 ? (
              <div className="editorial-empty">
                <span className="outline-number" aria-hidden="true">
                  <Image size={30} strokeWidth={1.4} />
                </span>
                <div>
                  <p className="eyebrow">МЕДИАТЕКА</p>
                  <h3>Здесь начинается хроника</h3>
                  <p>
                    Новые фотографии, видео и материалы появятся после
                    публикации редакцией.
                  </p>
                </div>
              </div>
            ) : (
              <div className="media-grid">
                {sortMedia(data?.media ?? [], "desc")
                  .slice(0, 3)
                  .map((m) => (
                    <MediaCard key={m.id} item={m} />
                  ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="page-intro">
            <p className="eyebrow">
              <Link to="/">ГЛАВНАЯ</Link> / {title.toUpperCase()}
            </p>
            <h1>
              {title}
              <span className="heading-dot">.</span>
            </h1>
            <p>
              {path === "/divisions"
                ? "Найдите региональный канал в каталоге с официального сайта объединения."
                : path === "/calendar"
                  ? "Опубликованные редакцией анонсы. Время событий указано по Москве."
                  : path === "/media"
                    ? "Хроника с 2022 года: события, фотографии и публикации объединения."
                    : "Подтверждённые ссылки на каналы и площадки."}
            </p>
          </div>
          {path === "/divisions" && (
            <>
              <label className="search-box">
                <Search size={20} />
                <input
                  aria-label="Найти город"
                  placeholder="Найти свой город"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span>{filtered.length}</span>
              </label>
              <div className="division-grid">
                {filtered.map((d) => (
                  <a key={d.name} href={d.url} target="_blank" rel="noreferrer">
                    <MapPin size={17} />
                    <span>{d.name}</span>
                    <ArrowUpRight size={18} />
                  </a>
                ))}
              </div>
              {!filtered.length && (
                <p className="empty">
                  Город не найден. Попробуйте другое название.
                </p>
              )}
              <p className="source-note">
                Источник каталога:{" "}
                <a
                  href="https://северныйчеловек.рф"
                  target="_blank"
                  rel="noreferrer"
                >
                  северныйчеловек.рф
                </a>{" "}
                · проверено 08.11.2026. Актуальность контактов уточняйте в
                региональном канале.
              </p>
            </>
          )}
          {path === "/media" && (
            <>
              {status}
              <div className="tabs" aria-label="Тип медиа">
                {[
                  ["all", "Все материалы"],
                  ["image", "Фотографии"],
                  ["video", "Видео"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={mediaType === id}
                    className={mediaType === id ? "active" : ""}
                    onClick={() => setMediaType(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="archive-controls">
                <Select
                  label="Год"
                  value={mediaYear}
                  onChange={setMediaYear}
                  options={[
                    { value: "all", label: "Все годы" },
                    ...mediaYears.map((year) => ({ value: year, label: year })),
                  ]}
                />
                <Select
                  label="Порядок"
                  value={mediaOrder}
                  onChange={(value) => setMediaOrder(value as "asc" | "desc")}
                  options={[
                    { value: "asc", label: "От истоков к сегодняшнему дню" },
                    { value: "desc", label: "Сначала новые" },
                  ]}
                />
              </div>
              <div className="media-grid">
                {archiveMedia.map((m) => (
                  <MediaCard key={m.id} item={m} />
                ))}
              </div>
              {data && !archiveMedia.length && (
                <p className="empty">
                  Материалы в этом разделе пока не опубликованы.
                </p>
              )}
            </>
          )}
          {path === "/calendar" && (
            <>
              {status}
              <div className="calendar-layout">
                <section className="calendar">
                  <div className="calendar-today-bar">
                    <p>
                      <span className="status-dot" />
                      Сегодня,{" "}
                      {new Date(
                        today.year,
                        today.month,
                        today.day,
                      ).toLocaleDateString("ru", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <button
                      className="button"
                      onClick={() => {
                        setMonth(new Date(today.year, today.month, 1));
                        setSelectedDay(today.day);
                      }}
                    >
                      Сегодня
                    </button>
                  </div>
                  <div className="calendar-toolbar">
                    <h2>
                      {month.toLocaleDateString("ru", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                    <button
                      aria-label="Предыдущий месяц"
                      onClick={() => {
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1,
                          ),
                        );
                        setSelectedDay(null);
                      }}
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      aria-label="Следующий месяц"
                      onClick={() => {
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1,
                          ),
                        );
                        setSelectedDay(null);
                      }}
                    >
                      <ChevronRight />
                    </button>
                  </div>
                  <div className="calendar-grid">
                    {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((d) => (
                      <span className="weekday" key={d}>
                        {d}
                      </span>
                    ))}
                    {Array.from(
                      { length: (month.getDay() + 6) % 7 },
                      (_, i) => (
                        <span key={`blank${i}`} />
                      ),
                    )}
                    {Array.from(
                      {
                        length: new Date(
                          month.getFullYear(),
                          month.getMonth() + 1,
                          0,
                        ).getDate(),
                      },
                      (_, i) => {
                        const day = i + 1;
                        const isToday =
                          day === today.day &&
                          month.getMonth() === today.month &&
                          month.getFullYear() === today.year;
                        const hasEvent = monthEvents.some(
                          (e) =>
                            new Date(
                              new Date(e.startsAt).getTime() + 3 * 3600000,
                            ).getUTCDate() === day,
                        );
                        return (
                          <button
                            key={day}
                            className={[
                              selectedDay === day ? "selected" : "",
                              isToday ? "today" : "",
                            ].join(" ")}
                            aria-current={isToday ? "date" : undefined}
                            title={isToday ? "Сегодня" : undefined}
                            aria-pressed={selectedDay === day}
                            onClick={() =>
                              setSelectedDay(selectedDay === day ? null : day)
                            }
                          >
                            {day}
                            {hasEvent && <span className="event-dot" />}
                          </button>
                        );
                      },
                    )}
                  </div>
                </section>
                <section className="event-list">
                  <p className="eyebrow">
                    {selectedDay
                      ? new Date(
                          month.getFullYear(),
                          month.getMonth(),
                          selectedDay,
                        ).toLocaleDateString("ru", {
                          day: "numeric",
                          month: "long",
                        })
                      : "СОБЫТИЯ МЕСЯЦА"}
                  </p>
                  {events.map((e) => (
                    <article key={e.id}>
                      <time>
                        {new Date(e.startsAt).toLocaleString("ru", {
                          timeZone: "Europe/Moscow",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        МСК
                      </time>
                      <h3>{e.title}</h3>
                      <p>
                        <MapPin size={14} />
                        {e.city}
                      </p>
                      <p>{e.description}</p>
                    </article>
                  ))}
                  {data && !events.length && (
                    <p className="empty">
                      На выбранный период событий пока нет.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
          {path === "/links" && (
            <div className="channel-grid">
              {channels.map((c) => (
                <a
                  className="channel-card"
                  key={c.name}
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="channel-icon">{c.short}</span>
                  <ArrowUpRight className="ml-auto" />
                  <h2>{c.name}</h2>
                  <p>{c.note}</p>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function MediaCard({ item }: { item: MediaRecord }) {
  const href = `/media/${item.id}`;
  const excerpt = item.description.split("\n\n")[1] ?? item.description;
  return (
    <article className="media-card">
      <Link
        className="media-cover"
        to={href}
        aria-label={`Открыть: ${item.title}`}
      >
        {item.kind === "video" ? (
          <video preload="metadata" src={item.url} aria-label={item.title} />
        ) : (
          <img src={item.url} alt={item.title} loading="lazy" />
        )}
        <span className="media-photo-count">
          {item.kind === "video"
            ? "Видео"
            : `Кадров: ${1 + (item.images?.length ?? 0)}`}
        </span>
      </Link>
      <p className="eyebrow">
        {item.eventDate ? (
          <time dateTime={item.eventDate}>
            {new Date(`${item.eventDate}T12:00:00+03:00`).toLocaleDateString(
              "ru",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Moscow",
              },
            )}
          </time>
        ) : (
          "МАТЕРИАЛ"
        )}
      </p>
      <h3>
        <Link to={href}>{item.title}</Link>
      </h3>
      <p className="media-excerpt">{excerpt}</p>
      <Link className="text-link" to={href}>
        Подробнее <ArrowUpRight size={16} />
      </Link>
    </article>
  );
}
