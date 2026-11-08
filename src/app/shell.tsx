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
          <Link
            className="brand"
            to="/"
            aria-label="Северный человек — главная"
          >
            <span className="brand-mark">
              С<span>Ч</span>
            </span>
            <span>
              СЕВЕРНЫЙ
              <br />
              ЧЕЛОВЕК<small>ИНФОРМАЦИОННЫЙ ПОРТАЛ</small>
            </span>
          </Link>
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
      <footer className="site-footer container">
        <Link className="brand" to="/">
          СЕВЕРНЫЙ ЧЕЛОВЕК<span className="heading-dot">.</span>
        </Link>
        <p>Медиа · Подразделения · События</p>
        <Link to="/admin">
          Вход для редакции <ArrowUpRight size={14} />
        </Link>
        <small>© {new Date().getFullYear()} · Информационный портал</small>
      </footer>
    </>
  );
}
