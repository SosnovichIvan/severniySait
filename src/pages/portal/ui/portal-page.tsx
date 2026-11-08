import {
  getMoscowDate,
  useMoscowToday,
} from "../../../shared/lib/calendar-date";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  MapPin,
  CalendarDays,
  Image,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { loadContent, divisions } from "../../../shared/api";
const channels = [
  {
    name: "Telegram",
    note: "Всероссийский ресурс",
    url: "https://t.me/sevchelrussia",
    short: "TG",
  },
  {
    name: "ВКонтакте",
    note: "Страница Михаила Маваши",
    url: "https://vk.ru/m.f.mavashi",
    short: "VK",
  },
  {
    name: "MAX",
    note: "Канал Михаила Маваши",
    url: "https://max.ru/channel_mikhailmavashi",
    short: "М",
  },
  {
    name: "Северная трибуна",
    note: "Канал проекта",
    url: "https://t.me/slavicsupport",
    short: "СТ",
  },
];
export function PortalPage() {
  const path = useLocation().pathname;
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["content"],
    queryFn: () => loadContent(),
  });
  const [search, setSearch] = useState("");
  const [mediaType, setMediaType] = useState("all");
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
          <div className="eyebrow pt-10">
            <span className="status-dot" /> ИНФОРМАЦИОННЫЙ ПОРТАЛ{" "}
            <span className="ml-auto hidden sm:inline">
              РОССИЯ · {new Date().getFullYear()}
            </span>
          </div>
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">ЛЮДИ. СОБЫТИЯ. ГЕОГРАФИЯ.</p>
              <h1 aria-label="Северный человек">
                Северный
                <br />
                <span>человек</span>
                <span className="heading-dot">.</span>
              </h1>
              <p className="hero-description">
                Материалы объединения, региональные подразделения и календарь
                событий — в одном пространстве.
              </p>
              <Link className="button primary" to="/media">
                Смотреть медиа <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" to="/divisions">
                Найти подразделение <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-art">
              <img
                src="/north.svg"
                alt="Графическая иллюстрация северного леса и гор"
              />
              <div className="art-top">
                <span>СЕВЕРНЫЙ / ЖУРНАЛ</span>
                <span>01 — {new Date().getFullYear()}</span>
              </div>
              <div className="art-bottom">
                <span className="compass">✳</span>
                <div>
                  ГЕОГРАФИЯ ОБЪЕДИНЕНИЯ
                  <br />
                  <strong>От региона к региону</strong>
                </div>
                <Link
                  to="/divisions"
                  aria-label="Посмотреть подразделения"
                  className="circle-button"
                >
                  <ArrowUpRight />
                </Link>
              </div>
            </div>
          </section>
          <div className="quick-grid">
            <Link to="/media">
              <Image />
              <span>
                Медиа<small>Фото, видео и публикации</small>
              </span>
              <ArrowUpRight />
            </Link>
            <Link to="/divisions">
              <MapPin />
              <span>
                Подразделения<small>Каталог региональных каналов</small>
              </span>
              <ArrowUpRight />
            </Link>
            <Link to="/calendar">
              <CalendarDays />
              <span>
                Календарь событий<small>Анонсы и встречи по городам</small>
              </span>
              <ArrowUpRight />
            </Link>
          </div>
          <section
            className="founder-section"
            id="founder"
            aria-labelledby="founder-title"
          >
            <div className="founder-profile">
              <p className="eyebrow">ОСНОВАТЕЛЬ ОБЪЕДИНЕНИЯ</p>
              <h2 id="founder-title" aria-label="Михаил Маваши">
                Михаил
                <br />
                <span>Маваши</span>
              </h2>
              <p className="founder-years">1985 — 2026</p>
              <p className="founder-fullname">Михаил Фёдорович Ниц</p>
              <p className="founder-role">
                Музыкант, автор песен и основатель «Северного человека».
              </p>
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
              <p>
                25 октября 2026 года Михаил Маваши умер в Воронеже. Об этом
                сообщили в его официальном канале; информацию подтвердили
                информационные агентства.
              </p>
              <p className="biography-sources">
                Источники:{" "}
                <a
                  href="https://www.rbc.ru/person/6addccc77ed5c3f0602233c7"
                  target="_blank"
                  rel="noreferrer"
                >
                  биография РБК <ArrowUpRight size={12} />
                </a>
                <a
                  href="https://m.interfax.ru/1124863"
                  target="_blank"
                  rel="noreferrer"
                >
                  Интерфакс <ArrowUpRight size={12} />
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
                <span className="outline-number">01</span>
                <div>
                  <p className="eyebrow">МЕДИАТЕКА</p>
                  <h3>Здесь начинается хроника</h3>
                  <p>
                    Новые фотографии, видео и материалы появятся после
                    публикации редакцией.
                  </p>
                </div>
                <Image size={36} strokeWidth={1} />
              </div>
            ) : (
              <div className="media-grid">
                {data?.media.slice(0, 3).map((m) => (
                  <article className="media-card" key={m.id}>
                    {m.kind === "video" ? (
                      <video
                        controls
                        preload="metadata"
                        src={m.url}
                        aria-label={m.title}
                      />
                    ) : (
                      <img src={m.url} alt={m.title} loading="lazy" />
                    )}
                    <p className="eyebrow">
                      {m.kind === "video" ? "ВИДЕО" : "ФОТО"}
                    </p>
                    <h3>{m.title}</h3>
                    <p>{m.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="connection">
            <div>
              <p className="eyebrow">ПЛОЩАДКИ И КАНАЛЫ</p>
              <h2>
                Продолжение —<br />в медиапространстве.
              </h2>
              <p>Выберите удобную площадку для чтения материалов.</p>
            </div>
            <div>
              {channels.slice(0, 3).map((c) => (
                <a key={c.name} href={c.url} target="_blank" rel="noreferrer">
                  <span className="channel-icon">{c.short}</span>
                  <span>
                    {c.name}
                    <small>{c.note}</small>
                  </span>
                  <ArrowUpRight size={20} />
                </a>
              ))}
            </div>
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
                    ? "Фотографии, видео и материалы редакции."
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
              <div className="media-grid">
                {data?.media
                  .filter((m) => mediaType === "all" || m.kind === mediaType)
                  .map((m) => (
                    <article className="media-card" key={m.id}>
                      {m.kind === "video" ? (
                        <video
                          controls
                          preload="metadata"
                          src={m.url}
                          aria-label={m.title}
                        />
                      ) : (
                        <a href={m.url} target="_blank" rel="noreferrer">
                          <img src={m.url} alt={m.title} loading="lazy" />
                        </a>
                      )}
                      <p className="eyebrow">
                        {m.kind === "video" ? "ВИДЕО" : "ФОТО"}
                      </p>
                      <h3>{m.title}</h3>
                      <p>{m.description}</p>
                    </article>
                  ))}
              </div>
              {data &&
                !data.media.some(
                  (m) => mediaType === "all" || m.kind === mediaType,
                ) && (
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
