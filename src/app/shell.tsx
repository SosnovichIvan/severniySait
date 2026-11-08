import { channels } from "../shared/config/channels";
import { useQuery } from "@tanstack/react-query";
import { loadContent } from "../shared/api";
import { useEffect, useState } from "react";
import { Link, NavLink, Routes, Route, useLocation } from "react-router-dom";
import { Sun, Moon, Menu, X, ArrowUpRight } from "lucide-react";
import { PortalPage } from "../pages/portal";
import { AdminPage } from "../pages/admin";
const links = [
  ["/", "Главная"],
  ["/media", "Медиа"],
  ["/divisions", "Подразделения"],
  ["/calendar", "Календарь событий"],
  ["/links", "Медиапространство"],
];
export function App() {
  const boot = useQuery({
    queryKey: ["content"],
    queryFn: () => loadContent(),
  });
  useEffect(() => {
    if (!boot.isPending) document.getElementById("boot-splash")?.remove();
  }, [boot.isPending]);
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") !== "light",
  );
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <nav
            className={open ? "navigation open" : "navigation"}
            aria-label="Основная навигация"
          >
            {links.map(([url, label]) => (
              <NavLink key={url} to={url} end>
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            className="icon-button theme-toggle"
            aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="icon-button menu-toggle"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<PortalPage />} />
        <Route path="/media" element={<PortalPage />} />
        <Route path="/divisions" element={<PortalPage />} />
        <Route path="/calendar" element={<PortalPage />} />
        <Route path="/links" element={<PortalPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <main id="main" className="container page-intro">
              <h1>Страница не найдена</h1>
              <Link className="text-link" to="/">
                На главную <ArrowUpRight />
              </Link>
            </main>
          }
        />
      </Routes>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-about">
              <Link className="footer-brand" to="/">
                Северный человек
              </Link>
              <p>
                Истории объединения, материалы из регионов и календарь событий —
                в одном пространстве.
              </p>
              <Link className="footer-editor" to="/admin">
                Вход для редакции <ArrowUpRight size={16} />
              </Link>
            </div>
            <nav className="footer-navigation" aria-label="Навигация в футере">
              <h2>Разделы</h2>
              <ul>
                {links.map(([url, label]) => (
                  <li key={url}>
                    <NavLink to={url} end>
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <section
              className="footer-channels"
              aria-labelledby="footer-channels-title"
            >
              <h2 id="footer-channels-title">Площадки и каналы</h2>
              <ul>
                {channels.map((channel) => (
                  <li key={channel.name}>
                    <a href={channel.url} target="_blank" rel="noreferrer">
                      {channel.name} <ArrowUpRight size={15} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <p className="footer-copyright">
            © {new Date().getFullYear()} · Информационный портал «Северный
            человек»
          </p>
        </div>
      </footer>
    </>
  );
}
