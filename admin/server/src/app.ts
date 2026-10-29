import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { dictionariesRouter } from "./routes/dictionaries.js";
import { eventsRouter } from "./routes/events.js";
import { eventSpeakersRouter, programRouter } from "./routes/program.js";
import { speakersRouter } from "./routes/speakers.js";
import { uploadsRouter } from "./routes/uploads.js";
import { registrationsRouter } from "./routes/registrations.js";
import { newsRouter } from "./routes/news.js";
import { documentsRouter, publicFilesRouter } from "./routes/documents.js";
import { eventPartnersRouter, partnersRouter } from "./routes/partners.js";
import { pagesRouter } from "./routes/pages.js";
import { eventResultsRouter } from "./routes/eventResults.js";
import { settingsRouter } from "./routes/settings.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { publicRouter } from "./routes/public.js";
import { contactRequestsRouter } from "./routes/contactRequests.js";
import { loadUser, requireAuth, requireCsrfHeader } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { siteErrorHandler, siteRouter } from "./site/router.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const adminDir = fileURLToPath(new URL("../../client/dist", import.meta.url));

export function createApp() {
  const app = express();

  if (config.isProd) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", (_req, res) => `'nonce-${(res as express.Response).locals.nonce ?? "none"}'`, "https://mc.yandex.ru"],
          "img-src": ["'self'", "data:", "https://mc.yandex.ru"],
          "connect-src": ["'self'", "https://mc.yandex.ru"],
          "frame-src": ["'self'", "https://yandex.ru", "https://*.yandex.ru"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(requireCsrfHeader);
  api.use(loadUser);
  api.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  api.use("/auth", authRouter);
  api.use("/public", publicRouter);
  api.use("/users", requireAuth, usersRouter);
  api.use("/dictionaries", requireAuth, dictionariesRouter);
  api.use("/events/:eventId/program", requireAuth, programRouter);
  api.use("/events/:eventId/speakers", requireAuth, eventSpeakersRouter);
  api.use("/events/:eventId/partners", requireAuth, eventPartnersRouter);
  api.use("/events/:eventId/results", requireAuth, eventResultsRouter);
  api.use("/events", requireAuth, eventsRouter);
  api.use("/speakers", requireAuth, speakersRouter);
  api.use("/uploads", requireAuth, uploadsRouter);
  api.use("/registrations", requireAuth, registrationsRouter);
  api.use("/news", requireAuth, newsRouter);
  api.use("/documents", requireAuth, documentsRouter);
  api.use("/partners", requireAuth, partnersRouter);
  api.use("/pages", requireAuth, pagesRouter);
  api.use("/settings", requireAuth, settingsRouter);
  api.use("/dashboard", requireAuth, dashboardRouter);
  api.use("/contact-requests", requireAuth, contactRequestsRouter);
  api.use(notFound);

  app.use("/api", api);
  app.use("/uploads/images", express.static(path.join(config.UPLOADS_DIR, "images"), { maxAge: "30d", immutable: true, index: false }));
  app.use("/files", publicFilesRouter);
  app.use("/assets", express.static(publicDir, { maxAge: config.isProd ? "7d" : 0, index: false }));
  if (existsSync(adminDir)) {
    app.use("/admin", express.static(adminDir, { index: false, maxAge: "1h" }));
    app.get(/^\/admin(\/.*)?$/, (_req, res) => {
      res.set("Cache-Control", "no-cache").sendFile(path.join(adminDir, "index.html"));
    });
  }
  app.use(siteRouter);
  app.use(siteErrorHandler);
  app.use(errorHandler);

  return app;
}
