import { randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { config } from "../config.js";
import { loadCtx, type SiteCtx } from "./context.js";
import { send, type View } from "./render.js";
import { homeView } from "./pages/home.js";
import { eventsView } from "./pages/events.js";
import { eventView } from "./pages/event.js";
import { newsListView, newsItemView } from "./pages/news.js";
import { aboutView } from "./pages/about.js";
import { contactsView } from "./pages/contacts.js";
import { svedenView } from "./pages/sveden.js";
import { searchView } from "./pages/search.js";
import { notFoundView, errorView, textView } from "./pages/text.js";
import { robotsTxt, sitemapXml } from "./seo.js";

export const siteRouter = Router();

declare global {
  namespace Express {
    interface Locals {
      nonce: string;
      ctx?: SiteCtx;
    }
  }
}

const YEAR = 365 * 24 * 60 * 60 * 1000;

function safeBack(v: unknown) {
  const s = typeof v === "string" ? v : "/";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

function setCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, { maxAge: YEAR, sameSite: "lax", secure: config.isProd, httpOnly: false, path: "/" });
}

siteRouter.get("/a11y/on", (req, res) => {
  setCookie(res, "a11y", "1");
  res.redirect(303, safeBack(req.query.back));
});

siteRouter.get("/a11y/off", (req, res) => {
  res.clearCookie("a11y", { path: "/" });
  res.redirect(303, safeBack(req.query.back));
});

siteRouter.get("/a11y/set", (req, res) => {
  const q = req.query;
  setCookie(res, "a11y", "1");
  if (q.fs === "1" || q.fs === "2" || q.fs === "3") setCookie(res, "a11y_fs", q.fs);
  if (q.sch === "bw" || q.sch === "wb" || q.sch === "blue") setCookie(res, "a11y_sch", q.sch);
  if (q.ls === "0" || q.ls === "1" || q.ls === "2") setCookie(res, "a11y_ls", q.ls);
  if (q.img === "0" || q.img === "1") setCookie(res, "a11y_img", q.img);
  res.redirect(303, safeBack(q.back));
});

siteRouter.get("/a11y/cookies", (req, res) => {
  setCookie(res, "cookies_ok", "1");
  res.redirect(303, safeBack(req.query.back));
});

siteRouter.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(robotsTxt());
});

siteRouter.get("/sitemap.xml", async (_req, res) => {
  res.type("application/xml").send(await sitemapXml());
});

type Handler = (ctx: SiteCtx, req: Request) => Promise<View | null>;

function page(handler: Handler) {
  return async (req: Request, res: Response) => {
    const ctx = await loadCtx(req, res.locals.nonce);
    res.locals.ctx = ctx;
    const view = (await handler(ctx, req)) ?? (await notFoundView(ctx));
    send(res, ctx, view);
  };
}

siteRouter.use((_req, res, next) => {
  res.locals.nonce = randomBytes(16).toString("base64");
  next();
});

siteRouter.get("/", page(homeView));
siteRouter.get("/events", page(eventsView));
siteRouter.get("/events/:slug", page((ctx, req) => eventView(ctx, String(req.params.slug))));
siteRouter.get("/news", page(newsListView));
siteRouter.get("/news/:slug", page((ctx, req) => newsItemView(ctx, String(req.params.slug))));
siteRouter.get("/sveden", page((ctx) => svedenView(ctx, null)));
siteRouter.get("/sveden/:key", page((ctx, req) => svedenView(ctx, String(req.params.key))));

siteRouter.get(
  /^\/(?!api\/|admin|files\/|uploads\/|assets\/).*/,
  page(async (ctx, req) => {
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, "") : req.path;
    for (const [key, p] of ctx.pages) {
      if (p.path !== path) continue;
      if (key === "about") return aboutView(ctx);
      if (key === "contacts") return contactsView(ctx);
      if (key === "search") return searchView(ctx, req);
      if (key === "privacy" || key === "consent" || key === "thanks") return textView(ctx, key);
    }
    return null;
  }),
);

export function siteErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/api/") || res.headersSent) return next(err);
  console.error(err);
  const ctx = res.locals.ctx;
  if (!ctx) {
    res.status(500).type("text").send("Внутренняя ошибка сервера");
    return;
  }
  send(res, ctx, errorView(ctx));
}
