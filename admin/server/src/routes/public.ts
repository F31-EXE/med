import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { formatDateOnly, todayDateOnly } from "../lib/dates.js";
import { sendMail } from "../lib/mailer.js";
import { normalizePhone } from "../lib/registrations.js";
import { findPageDef } from "../lib/pages.js";
import { getSiteSettings } from "./settings.js";
import { publicEventsRouter } from "./publicEvents.js";
import { HttpError } from "../middleware/error.js";

export const publicRouter = Router();

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Слишком много заявок. Попробуйте позже" },
});

async function page(key: string) {
  const def = findPageDef(key)!;
  const row = await prisma.page.findUnique({ where: { key } });
  return {
    key,
    title: row?.title ?? def.title,
    path: def.pathEditable ? (row?.path ?? def.defaultPath) : def.defaultPath,
    body: row?.body ?? null,
    blocks: row?.blocks ?? {},
  };
}

publicRouter.get("/site", async (_req, res) => {
  const now = new Date();
  const today = todayDateOnly();
  const [settings, home, about, contacts, events, news, partners] = await Promise.all([
    getSiteSettings(),
    page("home"),
    page("about"),
    page("contacts"),
    prisma.event.findMany({
      where: { deletedAt: null, status: "PUBLISHED", archivedAt: null, endDate: { gte: today } },
      orderBy: { startDate: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        format: true,
        startDate: true,
        endDate: true,
        nmoPoints: true,
        venueName: true,
        coverThumbUrl: true,
        city: { select: { name: true } },
      },
    }),
    prisma.news.findMany({
      where: { deletedAt: null, status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      orderBy: { publishAt: "desc" },
      take: 3,
      select: { id: true, title: true, slug: true, excerpt: true, coverThumbUrl: true, publishAt: true },
    }),
    prisma.partner.findMany({
      where: { showOnHome: true },
      orderBy: [{ homeSortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, url: true, logoThumbUrl: true },
    }),
  ]);

  res.json({
    contacts: settings.contacts,
    numbers: settings.numbers,
    pages: { home, about, contacts },
    events: events.map((e) => ({ ...e, startDate: formatDateOnly(e.startDate), endDate: formatDateOnly(e.endDate), city: e.city?.name ?? null })),
    news,
    partners,
  });
});

const contactSchema = z
  .object({
    name: z.string({ error: "Введите имя" }).trim().min(2, "Введите имя").max(120),
    organization: z.string().trim().max(200).nullish().transform((v) => v || null),
    phone: z
      .string()
      .nullish()
      .transform((v, ctx) => {
        if (!v?.trim()) return null;
        const phone = normalizePhone(v);
        if (!phone) ctx.addIssue({ code: "custom", message: "Введите номер в формате +7 (900) 000-00-00" });
        return phone;
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .nullish()
      .transform((v) => v || null)
      .refine((v) => !v || z.email().safeParse(v).success, "Введите корректный e-mail"),
    comment: z.string().trim().max(3000).nullish().transform((v) => v || null),
    source: z.string().trim().max(100).nullish().transform((v) => v || null),
    consent: z.literal(true, { error: "Нужно согласие на обработку персональных данных" }),
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.phone || v.email, { path: ["phone"], message: "Укажите телефон или e-mail" });

publicRouter.post("/contact-requests", formLimiter, async (req, res) => {
  if (typeof req.body?.website === "string" && req.body.website) {
    res.status(201).json({ ok: true });
    return;
  }
  const { consent: _c, website: _w, ...data } = contactSchema.parse(req.body);
  const created = await prisma.contactRequest.create({ data: { ...data, consentAt: new Date(), ip: req.ip } });

  const settings = await getSiteSettings();
  if (settings.notifications.emails.length) {
    const lines = [
      `Имя: ${created.name}`,
      created.organization && `Организация: ${created.organization}`,
      created.phone && `Телефон: ${created.phone}`,
      created.email && `E-mail: ${created.email}`,
      created.comment && `Комментарий: ${created.comment}`,
      created.source && `Страница: ${created.source}`,
    ].filter(Boolean) as string[];
    const html = lines.map((l) => `<p>${l.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</p>`).join("");
    await Promise.all(
      settings.notifications.emails.map((to) =>
        sendMail(to, "Новое обращение с сайта med-expo.org", lines.join("\n"), html).catch((e) => console.error("Не удалось отправить уведомление:", e)),
      ),
    );
  }

  res.status(201).json({ ok: true });
});

publicRouter.use("/events", publicEventsRouter);

publicRouter.use((_req, _res, next) => next(new HttpError(404, "Не найдено")));
