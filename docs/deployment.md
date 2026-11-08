# VPS / Docker

Текущее состояние: работа локально, по уточнению пользователя от 08.11.2026.
VPS, домен и SSH не подключены; публичного production-деплоя нет. GitHub хранит
код и правила будущей доставки. Создавать релизный тег для просмотра дизайна не нужно.

## Релиз после приёмки

1. PR рабочей ветки в develop: format, ESLint/FSD, TypeScript, unit/integration,
   coverage 90% строк/ветвей, Cypress и проверочная компиляция.
2. PR develop → main с теми же проверками. Другие источники в main CI отклоняет.
3. Владелец создаёт новый неизменяемый тег MAJOR.MINOR.PATCH на принятом main.
   Workflow проверяет формат, принадлежность коммита удалённой main и повторно
   запускает проверки на самом теге. После сборки выполняется health/static smoke
   контейнера; только затем Docker-образ публикуется.
4. Workflow Deploy released version to VPS запускается вручную с принятым тегом
   из main. Environment production требует подтверждение SosnovichIvan.
   Скрипт передаёт на VPS только номер версии и не меняет серверный .env.

GitHub rulesets запрещают изменение/удаление существующих Git-тегов, прямой push,
force push и удаление main/develop. Единственный bypass — User SosnovichIvan для
ревью в режиме pull_request. Он не обходит PR/quality-gate.

Workflow Actions закреплены SHA. PR выполняются на GitHub-hosted runner без
production secrets и не публикуют образ. Cypress использует временную тестовую БД.

## Когда будет выбран VPS

Нужен Linux с Docker Engine и Compose v2, доступный TCP 80/443 и UDP 443,
домен с DNS на сервер. Текущий release runner собирает linux/amd64; для ARM VPS
перед первым выпуском следует добавить соответствующую платформу Buildx.

На сервер копируются compose.yaml, Caddyfile и scripts/deploy.sh в одну директорию.
Серверный .env должен содержать:

```dotenv
SITE_ADDRESS=your-domain.example
RELEASE_TAG=0.1.0
SESSION_SECRET=<random secret of at least 32 characters>
ADMIN_PASSWORD_HASH='<bcrypt hash, single quotes preserve dollar signs>'
```

Хеш можно получить локально без отправки пароля во внешние сервисы:

```sh
read -rs ADMIN_PASSWORD
export ADMIN_PASSWORD
node --input-type=module -e 'import { hash } from "bcryptjs"; console.log(await hash(process.env.ADMIN_PASSWORD,12))'
unset ADMIN_PASSWORD
```

Хеш и secret переносятся в серверный .env, права файла 0600. Пароль не попадает
в браузерный bundle или Docker build context. Локальные .env/пароль на VPS
не копируются. Single quotes защищают символы `$` хеша от Compose interpolation
([документация Docker](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation)).

Первое развёртывание из серверной директории:

```sh
./scripts/deploy.sh 0.1.0
```

Caddy выдаёт HTTPS для домена. App не публикует порт на хост и работает от
непривилегированного пользователя с read-only root filesystem; БД/медиа в volumes.
Для приватного GHCR package серверу дополнительно нужен read-only package login;
публичный GitHub repository сам по себе не гарантирует публичность package.

## Подключение GitHub-деплоя

Repository Variables: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH.
Environment production Secrets: DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS.

Использовать отдельного SSH-пользователя и ключ с ограниченной серверной командой,
соответствующей deploy.sh. Fingerprint сервера сверяется по доверенному каналу;
StrictHostKeyChecking не отключается. Изменения инфраструктуры VPS и создание
учётных записей в текущем локальном этапе не выполнялись.

## Данные и восстановление

Volumes portal-data и portal-uploads переживают замену контейнера. Не выполнять
`docker compose down -v` на сервере с данными. До релиза резервировать БД через
SQLite Online Backup API и каталог uploads в согласованную точку; хранить копии
вне VPS. Восстановление проверять в отдельной среде до заявления о его готовности.

Возврат приложения — deploy предыдущего тега, только если схема совместима.
Текущая схема v1 создаётся идемпотентно; production backup/restore и SSH-деплой
пока не проверялись. Опубликованный образ и Git-тег не заменяют резервную копию.
