import express from "express";
import {
  compareReleaseVersions,
  latestRelease,
} from "../domain/latest-release.js";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { compare } from "bcryptjs";
import { z } from "zod";
import {
  eventInput,
  mediaInput,
  divisionSaveInput,
  channelInput,
  publicationInput,
  publicationKind,
  deploymentInput,
  contentUpdateInput,
  deploymentVersion,
} from "../../contracts/content.js";
import { Store } from "../repository/store.js";
import { SqliteSessions } from "../repository/session-store.js";
import { identifyMedia } from "../domain/media-file.js";
export type AppOptions = {
  store: Store;
  uploadDir: string;
  sessionSecret: string;
  passwordHash: string;
  production?: boolean;
  deploymentEnabled?: boolean;
  currentVersion?: string;
  resolveDeploymentVersion?: () => Promise<string | null>;
};
export function createApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  if (options.production) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "upgrade-insecure-requests": options.production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(
    session({
      name: "sever.sid",
      secret: options.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new SqliteSessions(options.store),
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: !!options.production,
        maxAge: 8 * 3600000,
      },
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/content", (_req, res) => res.json(options.store.list()));
  app.get("/api/session", (req, res) => {
    req.session.csrf ??= randomBytes(32).toString("hex");
    res
      .set("Cache-Control", "no-store")
      .json({ admin: !!req.session.admin, csrf: req.session.csrf });
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf)
    )
      return res
        .status(403)
        .json({ error: "Обновите страницу и повторите действие." });
    next();
  });
  app.post(
    "/api/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({ password: z.string().min(1).max(200) })
          .safeParse(req.body);
        if (
          !parsed.success ||
          !(await compare(parsed.data.password, options.passwordHash))
        )
          return res.status(401).json({ error: "Неверный пароль." });
        req.session.regenerate((err) => {
          if (err) return next(err);
          req.session.admin = true;
          req.session.csrf = randomBytes(32).toString("hex");
          res.json({ admin: true, csrf: req.session.csrf });
        });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post("/api/logout", (req, res, next) =>
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("sever.sid").json({ ok: true });
    }),
  );
  app.use("/api/admin", (req, res, next) => {
    if (!req.session.admin)
      return res.status(401).json({ error: "Войдите в панель управления." });
    next();
  });
  app.get("/api/admin/content", (_req, res) =>
    res.json(options.store.list(true)),
  );
  app.get("/api/admin/content-updates", (_req, res) =>
    res.json({
      jobs: options.store.contentUpdates.list(),
      drafts: options.store.contentUpdates.drafts(),
    }),
  );
  app.post("/api/admin/content-updates", (req, res) => {
    const input = contentUpdateInput.parse(req.body);
    const now = new Date();
    if (Date.parse(input.scheduledAt) < now.getTime() + 60000)
      return res
        .status(400)
        .json({ error: "Выберите время минимум на минуту позже текущего." });
    try {
      const id = options.store.contentUpdates.schedule(
        input.targets,
        new Date(input.scheduledAt).toISOString(),
        now.toISOString(),
      );
      return res.status(201).json({ id });
    } catch (error) {
      return res.status(409).json({ error: (error as Error).message });
    }
  });
  app.delete("/api/admin/content-updates/:id", (req, res) => {
    if (!options.store.contentUpdates.cancel(req.params.id))
      return res
        .status(409)
        .json({ error: "Можно отменить только запланированную публикацию." });
    return res.json({ ok: true });
  });
  app.get("/api/admin/deployments", (_req, res) =>
    res.json({
      enabled: !!options.deploymentEnabled,
      currentVersion: options.currentVersion ?? "local",
      jobs: options.store.deployments(),
    }),
  );
  app.post("/api/admin/deployments", async (req, res) => {
    if (!options.deploymentEnabled)
      return res.status(410).json({
        error: "Обновления кода выполняются только GitHub Actions по тегу.",
      });
    const input = deploymentInput.parse(req.body);
    const now = new Date();
    if (new Date(input.scheduledAt).getTime() < now.getTime() + 60000)
      return res
        .status(400)
        .json({ error: "Выберите время минимум на минуту позже текущего." });
    let version: string | null;
    try {
      version = await (options.resolveDeploymentVersion ?? latestRelease)();
    } catch {
      return res.status(503).json({
        error: "Не удалось проверить готовые обновления. Повторите позже.",
      });
    }
    if (
      !version ||
      (options.currentVersion &&
        deploymentVersion.safeParse(options.currentVersion).success &&
        compareReleaseVersions(version, options.currentVersion) <= 0)
    )
      return res
        .status(409)
        .json({ error: "Готовых опубликованных обновлений пока нет." });
    const id = options.store.scheduleDeployment(
      version,
      new Date(input.scheduledAt).toISOString(),
      now.toISOString(),
    );
    if (!id)
      return res
        .status(409)
        .json({ error: "Сначала отмените или дождитесь текущего обновления." });
    res.status(201).json({ id });
  });
  app.delete("/api/admin/deployments/:id", (req, res) => {
    if (!options.store.cancelDeployment(req.params.id))
      return res
        .status(409)
        .json({ error: "Можно отменить только запланированное обновление." });
    res.json({ ok: true });
  });
  app.patch("/api/admin/:kind/:id/publication", (req, res) => {
    const kind = publicationKind.parse(req.params.kind);
    const { published } = publicationInput.parse(req.body);
    if (!options.store.setPublication(kind, req.params.id, published))
      return res.status(404).json({ error: "Запись не найдена." });
    res.json({ ok: true });
  });
  app.post("/api/admin/channels", (req, res) => {
    res
      .status(201)
      .json({ id: options.store.saveChannel(channelInput.parse(req.body)) });
  });
  app.put("/api/admin/channels/:id", (req, res) => {
    const input = channelInput.parse(req.body);
    if (
      !options.store
        .list(true)
        .channels.some((channel) => channel.id === req.params.id)
    )
      return res.status(404).json({ error: "Площадка не найдена." });
    res.json({ id: options.store.saveChannel(input, req.params.id) });
  });
  app.delete("/api/admin/channels/:id", (req, res) => {
    if (!options.store.deleteChannel(req.params.id))
      return res.status(404).json({ error: "Площадка не найдена." });
    res.json({ ok: true });
  });
  app.post("/api/admin/divisions", (req, res) => {
    const input = divisionSaveInput.parse(req.body);
    if (options.store.divisionCatalog.find(input.name))
      return res
        .status(409)
        .json({ error: "Подразделение с таким названием уже существует." });
    res.status(201).json({ id: options.store.saveDivision(input) });
  });
  app.put("/api/admin/divisions/:id", (req, res) => {
    const input = divisionSaveInput.parse(req.body);
    const previous = options.store.divisionCatalog.find(req.params.id);
    if (!previous)
      return res.status(404).json({ error: "Подразделение не найдено." });
    const conflict = options.store.divisionCatalog.find(input.name);
    if (conflict && conflict.id !== previous.id)
      return res
        .status(409)
        .json({ error: "Подразделение с таким названием уже существует." });
    res.json({ id: options.store.saveDivision(input, previous.id) });
  });
  app.delete("/api/admin/divisions/:id", (req, res) => {
    if (!options.store.divisionCatalog.archive(req.params.id, true))
      return res.status(404).json({ error: "Подразделение не найдено." });
    res.json({ ok: true });
  });
  app.patch("/api/admin/divisions/:id/archive", (req, res) => {
    if (!options.store.divisionCatalog.archive(req.params.id, false))
      return res.status(404).json({ error: "Подразделение не найдено." });
    res.json({ ok: true });
  });
  // Compatibility for previous editorial clients; new UI uses stable identities.
  app.put("/api/admin/divisions", (req, res) => {
    options.store.saveDivision(divisionSaveInput.parse(req.body));
    res.json({ ok: true });
  });
  app.post("/api/admin/events", (req, res) => {
    const input = eventInput.parse(req.body);
    res.status(201).json({ id: options.store.saveEvent(input) });
  });
  app.put("/api/admin/events/:id", (req, res) => {
    const input = eventInput.parse(req.body);
    if (!options.store.list(true).events.some((e) => e.id === req.params.id))
      return res.status(404).json({ error: "Событие не найдено." });
    res.json({ id: options.store.saveEvent(input, req.params.id) });
  });
  app.delete("/api/admin/events/:id", (req, res) => {
    if (!options.store.deleteEvent(req.params.id))
      return res.status(404).json({ error: "Событие не найдено." });
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 4 },
  });
  app.post(
    "/api/admin/media",
    upload.single("file"),
    async (req, res, next) => {
      try {
        const input = mediaInput.parse({
          ...req.body,
          published: req.body.published === "true",
        });
        const type = req.file && identifyMedia(req.file.buffer);
        if (!type || !req.file)
          return res
            .status(400)
            .json({ error: "Загрузите PNG, JPEG, WebP или MP4 (до 30 МБ)." });
        const name = `${randomUUID()}.${type.extension}`;
        await mkdir(options.uploadDir, { recursive: true });
        const path = resolve(options.uploadDir, name);
        await writeFile(path, req.file.buffer, { flag: "wx" });
        try {
          const id = options.store.addMedia({
            ...input,
            url: `/uploads/${name}`,
            kind: type.kind,
          });
          res.status(201).json({ id });
        } catch (error) {
          await unlink(path);
          throw error;
        }
      } catch (error) {
        next(error);
      }
    },
  );
  app.put("/api/admin/media/:id", (req, res) => {
    const input = mediaInput.parse(req.body);
    if (!options.store.updateMedia(req.params.id, input))
      return res.status(404).json({ error: "Материал не найден." });
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/media/:id/images",
    upload.single("file"),
    async (req, res, next) => {
      try {
        const item = options.store
          .list(true)
          .media.find((m) => m.id === req.params.id);
        if (!item)
          return res.status(404).json({ error: "Материал не найден." });
        if (options.store.images(item.id).length >= 30)
          return res
            .status(400)
            .json({ error: "В галерее может быть не более 30 фотографий." });
        const type = req.file && identifyMedia(req.file.buffer);
        if (!req.file || !type || type.kind !== "image")
          return res.status(400).json({
            error: "Выберите фотографию PNG, JPEG или WebP (до 30 МБ).",
          });
        const name = `${randomUUID()}.${type.extension}`;
        await mkdir(options.uploadDir, { recursive: true });
        const path = resolve(options.uploadDir, name);
        await writeFile(path, req.file.buffer, { flag: "wx" });
        try {
          const id = options.store.addImage(item.id, `/uploads/${name}`);
          res.status(201).json({ id });
        } catch (error) {
          await unlink(path);
          throw error;
        }
      } catch (error) {
        next(error);
      }
    },
  );
  app.delete("/api/admin/media/:id/images/:imageId", async (req, res, next) => {
    try {
      const image = options.store.deleteImage(
        req.params.id,
        req.params.imageId,
      );
      if (!image)
        return res.status(404).json({ error: "Фотография не найдена." });
      await unlink(resolve(options.uploadDir, basename(image.url))).catch(
        () => {},
      );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  app.delete("/api/admin/media/:id", async (req, res, next) => {
    try {
      const row = options.store.deleteMedia(req.params.id);
      if (!row) return res.status(404).json({ error: "Материал не найден." });
      await Promise.all(
        [row, ...row.images].map((image) =>
          unlink(resolve(options.uploadDir, basename(image.url))).catch(
            () => {},
          ),
        ),
      );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  app.use("/uploads/:name", (req, res, next) => {
    const item = options.store
      .list(true)
      .media.find(
        (m) =>
          m.url === `/uploads/${req.params.name}` ||
          m.images?.some(
            (image) => image.url === `/uploads/${req.params.name}`,
          ),
      );
    if (!item || (!item.published && !req.session.admin))
      return res.sendStatus(404);
    next();
  });
  app.use(
    "/uploads",
    express.static(resolve(options.uploadDir), {
      dotfiles: "deny",
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Ресурс не найден." }),
  );
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof z.ZodError)
        return res.status(400).json({
          error: "Проверьте поля формы.",
          fields: error.flatten().fieldErrors,
        });
      if (error instanceof multer.MulterError)
        return res
          .status(400)
          .json({ error: "Файл слишком большой или неверный формат запроса." });
      if (error instanceof SyntaxError)
        return res.status(400).json({ error: "Некорректный запрос." });
      console.error(
        "Request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      res
        .status(500)
        .json({ error: "Не удалось выполнить действие. Попробуйте ещё раз." });
    },
  );
  return app;
}
