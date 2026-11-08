# Северный человек — информационный портал

React + TypeScript + Tailwind CSS, Express, SQLite. Главная, Медиа,
Подразделения, Календарь событий, Медиапространство (Telegram/VK/MAX).
Светлая и тёмная темы; админка для фото/видео и событий с черновиками.

## Локально

Требуется Node.js 24.12.0 и npm.

```sh
npm ci
npm run setup:local
npm run dev
```

[Сайт](http://localhost:5173) · [Админка](http://localhost:5173/admin).
Пароль создаётся случайно в `.local-admin-password` (права 0600, Git его
игнорирует). Настройки и bcrypt-хеш в `.env`; эти файлы не публикуются.
`setup:local` не перезаписывает существующий `.env`. Не используйте локальный
пароль на production. Время в редакторе и календаре — Москва.

## Проверка

```sh
npm run format:check
npm run check
npm run verify:compile
npm run test:e2e
```

Coverage V8: минимум 90% строк и ветвей отдельно frontend/backend/contracts,
включая неимпортированные файлы. Cypress запускает изолированные API, frontend
и временную SQLite с фиктивными данными, не изменяя локальный контент редакции.
Проверочная компиляция `.preview` не является релизом. `npm run build` используется
в Docker-релизе после валидации версионного тега.

## Дизайн и исследование

- [Дизайн и макеты](design/README.md), стартовый макет `design/home-dark.html`.
- [Источники и выводы](docs/research.md).
- [Архитектура, данные и ограничения](docs/architecture.md).
- [Деплой на VPS](docs/deployment.md).
- [Матрица проверок](docs/quality.md).

## Доставка изменений

Рабочая ветка → PR в `develop` → PR `develop` → `main`.
Прямые push, force push и удаление main/develop запрещены. Обязателен
`quality-gate` GitHub Actions. CODEOWNERS требует апрув `SosnovichIvan`;
только этот пользователь может обойти ревью при слиянии PR. Обязательные
проверки и необходимость PR обходу не подлежат.

Репозиторий публичный; конфигурация правил в `.github/branch-rules.json`.
Релиз — неизменяемый тег `MAJOR.MINOR.PATCH` на коммите из main.
Реальное размещение требует данных VPS и домена; пока production не развёрнут.
