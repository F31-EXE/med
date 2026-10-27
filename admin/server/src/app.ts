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
import { loadUser, requireAuth, requireCsrfHeader } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";

export function createApp() {
  const app = express();

  if (config.isProd) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(requireCsrfHeader);
  api.use(loadUser);
  api.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  api.use("/auth", authRouter);
  api.use("/users", requireAuth, usersRouter);
  api.use("/dictionaries", requireAuth, dictionariesRouter);
  api.use("/events/:eventId/program", requireAuth, programRouter);
  api.use("/events/:eventId/speakers", requireAuth, eventSpeakersRouter);
  api.use("/events", requireAuth, eventsRouter);
  api.use("/speakers", requireAuth, speakersRouter);
  api.use("/uploads", requireAuth, uploadsRouter);
  api.use("/registrations", requireAuth, registrationsRouter);
  api.use("/news", requireAuth, newsRouter);
  api.use(notFound);

  app.use("/api", api);
  app.use("/uploads", express.static(config.UPLOADS_DIR, { maxAge: "30d", immutable: true, index: false }));
  app.use(errorHandler);

  return app;
}
