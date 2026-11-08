# Матрица проверок

| Компонент | Команды | Среда | Required check |
| --- | --- | --- | --- |
| React frontend, FSD | format:check, lint, typecheck, test:coverage | jsdom / Vitest | quality-gate через checks |
| API, сессии, файлы | test:coverage | Node 24, реальная временная SQLite, Supertest | quality-gate через checks |
| Контракты Zod | typecheck, test:coverage | Обе стороны API | quality-gate через checks |
| Схема SQLite v1 | integration tests внутри test:coverage | Пустая БД, повтор миграции с данными, integrity/FK checks | quality-gate через checks |
| Браузер | test:e2e | Cypress, реальный API + временная БД, 390/1280 px | quality-gate через checks |
| CSS/JS | verify:compile | Vite test mode, без публикации | quality-gate через checks |
| Docker/Compose | docker compose config, bash -n, actionlint | Без production secrets | checks / локальная валидация |
| Релизный образ | build и health/static smoke | Только валидный тег на main | release, до docker push |

Worker, bot, очередь и сторонние интеграции отсутствуют: N/A. Процент DDL
не выдумывается: его инварианты проверяет реальная SQLite. Схема v0 отсутствует;
downgrade не поддерживается. Производственные миграции не выполнялись.

Coverage измеряется V8 (Vitest 5.1.0), включает все авторские src/server/contracts,
включая entrypoints. Исключений исполняемого кода нет. Порог 90% строк и ветвей
задан отдельно для src/**, server/** и contracts/**; отчёт ниже порога завершает
CI с ошибкой. Неуспешные/cancelled/skipped checks отклоняются quality-gate.
Скрывающих ошибок continue-on-error и workflow paths filter нет.

Локально прошли unit/integration/component tests и шесть Cypress E2E:
навигация/каталог; темы и мобильное меню; CRUD/публикация событий; загрузка,
отображение, удаление медиа и проверка авторизации. Смена темы и адаптация
также проверены в открытом локальном OpenDesign. Макеты OpenDesign статические;
полный CRUD проверяется в самом приложении.

Релизный Docker-образ пока не собран: по policy сборка разрешена после
принятого тега на main. Production/SSH не проверялись и не подключались по
уточнению пользователя «пока делаем всё локально».

## Измерено локально

33 unit/integration/component tests, 6 Cypress tests — passed.

| Область | Lines | Branches |
| --- | --- | --- |
| src | 99.45% | 97.25% |
| server | 99.35% | 95.12% |
| contracts | 100.00% | N/A |

Дополнительные проверки: логотип на стартовом экране до готовности API,
биография с источниками, дата Москвы на границе UTC/нового года, обновление
даты при возвращении фокуса/переходе через полночь, отдельные today/selected
и кнопка «Сегодня».

## Галереи и страницы материалов, 08.11.2026

`npm run check`: 44 unit/integration/component tests passed (Vitest 5.1.0 / V8).
Порог 90% строк/ветвей отдельно для frontend/backend соблюдён.
Frontend: 98.80% lines, 96.27% branches; backend: 99.48% lines, 96.19% branches.
Области и exclusions прежние; снимок измерений не является diff coverage.
Миграция v1 → v3 с заполненным архивом, повторное открытие, integrity/FK,
скрытие фото черновиков, проверка сигнатур, лимит, удаление и сбой вставки
проверены на временной SQLite. Локальный импорт выполнен дважды без дублей.

`npm run test:e2e`: 7 Cypress сценариев passed, включая переход карточка →
страница материала, загрузку двух фотографий, стрелки/миниатюры/клавиатуру,
полноэкранный режим, Escape и возврат фокуса, свайп, перезагрузку прямого URL,
удаление фото и материала. Скриншоты галереи проверены на 1280/390 px в обеих темах.
OpenDesign содержит 37 HTML-макетов (включая отдельные страницы всех 12 материалов).
