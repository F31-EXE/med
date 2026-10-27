import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { dictionariesRouter } from "./routes/dictionaries.js";
import { eventsRouter } from "./routes/events.js";
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
  api.use("/events", requireAuth, eventsRouter);
  api.use(notFound);

  app.use("/api", api);
  app.use(errorHandler);

  return app;
}
