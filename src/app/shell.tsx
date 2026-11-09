import { LoginDialog } from "../features/editor-login";
import { useQuery } from "@tanstack/react-query";
import { loadContent } from "../shared/api";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Sun, Moon, Menu, X, ArrowUpRight, LogIn } from "lucide-react";
import { PortalPage, MediaDetail } from "../pages/portal";
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
  const [loginOpen, setLoginOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setOpen(false);
    setLoginOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const themeToggle = (
    <button
      className="icon-button theme-toggle"
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      onClick={() => setDark(!dark)}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
  const isAdmin = location.pathname === "/admin";
  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      {!isAdmin && (
        <header className="site-header">
          <div className="container header-inner">
            <Link
              className="header-brand"
              to="/"
              aria-label="Северный человек — главная"
            >
              <span className="header-brand-name" aria-hidden="true">
                Северный<span>человек</span>
                <small className="header-region">Москва и область</small>
              </span>
              <span className="header-brand-short" aria-hidden="true">
                СЧ
              </span>
            </Link>
            <nav
              className={open ? "navigation open" : "navigation"}
              aria-label="Основная навигация"
            >
              {links.map(([url, label]) => (
                <NavLink key={url} to={url} end={url !== "/media"}>
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="header-actions">
              <button
                type="button"
                className="editor-login"
                aria-haspopup="dialog"
                aria-expanded={loginOpen}
                onClick={() => {
                  setOpen(false);
                  setLoginOpen(true);
                }}
                aria-label="Войти для редакции"
                title="Войти для редакции"
              >
                <LogIn size={18} aria-hidden="true" />
                Войти
              </button>
              {themeToggle}
            </div>
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
      )}
      {loginOpen && (
        <LoginDialog
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            setLoginOpen(false);
            navigate("/admin");
          }}
        />
      )}
      <Routes>
        <Route path="/" element={<PortalPage />} />
        <Route path="/media" element={<PortalPage />} />
        <Route path="/media/:id" element={<MediaDetail />} />
        <Route path="/divisions" element={<PortalPage />} />
        <Route path="/calendar" element={<PortalPage />} />
        <Route path="/links" element={<PortalPage />} />
        <Route
          path="/admin"
          element={<AdminPage themeToggle={themeToggle} />}
        />
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
      {!isAdmin && (
        <footer className="site-footer">
          <div className="container">
            <div className="footer-grid">
              <div className="footer-about">
                <Link className="footer-brand" to="/">
                  Северный человек
                </Link>
                <p>
                  Истории Москвы и Подмосковья, материалы объединения и
                  календарь событий — в одном пространстве.
                </p>
              </div>
              <nav
                className="footer-navigation"
                aria-label="Навигация в футере"
              >
                <h2>Разделы</h2>
                <ul>
                  {links.map(([url, label]) => (
                    <li key={url}>
                      <NavLink to={url} end={url !== "/media"}>
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
                  {(boot.data?.channels ?? []).map((channel) => (
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
              человек» · Москва и Московская область
            </p>
          </div>
        </footer>
      )}
    </>
  );
}
