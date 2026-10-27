import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const partnersRouter = Router();
export const eventPartnersRouter = Router({ mergeParams: true });

partnersRouter.use(requireRole("ADMIN", "EDITOR"));
eventPartnersRouter.use(requireRole("ADMIN", "EDITOR"));

const PAGE_SIZE = 30;
const levels = ["GENERAL", "OFFICIAL", "INFO"] as const;

const uploadUrl = z
  .string()
  .regex(/^\/uploads\/[\w/.-]+\.webp$/, "Некорректная ссылка на логотип")
  .nullish()
  .transform((v) => v || null);

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(200),
  url: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v, ctx) => {
      if (!v) return null;
      const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      try {
        const u = new URL(withScheme);
        if (!u.hostname.includes(".")) throw new Error();
        return u.toString();
      } catch {
        ctx.addIssue({ code: "custom", message: "Введите адрес сайта, например med-expo.org" });
        return null;
      }
    }),
  description: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null),
  logoUrl: uploadUrl,
  logoThumbUrl: uploadUrl,
  showOnHome: z.boolean().default(false),
});

const brief = { id: true, name: true, url: true, logoThumbUrl: true } satisfies Prisma.PartnerSelect;
const include = { _count: { select: { events: true } } } satisfies Prisma.PartnerInclude;

function serialize(p: Prisma.PartnerGetPayload<{ include: typeof include }>) {
  const { _count, ...rest } = p;
  return { ...rest, eventsCount: _count.events };
}

async function findPartner(id: string) {
  const p = await prisma.partner.findUnique({ where: { id }, include });
  if (!p) throw new HttpError(404, "Партнёр не найден");
  return p;
}

partnersRouter.get("/", async (req, res) => {
  const q = z
    .object({
      q: z.string().trim().max(100).optional(),
      home: z.enum(["true"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
    })
    .parse(req.query);
  const where: Prisma.PartnerWhereInput = {
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { url: { contains: q.q, mode: "insensitive" } }] } : {}),
    ...(q.home ? { showOnHome: true } : {}),
  };
  const orderBy: Prisma.PartnerOrderByWithRelationInput[] = q.home ? [{ homeSortOrder: "asc" }, { name: "asc" }] : [{ name: "asc" }];
  const [total, rows] = await Promise.all([
    prisma.partner.count({ where }),
    prisma.partner.findMany({ where, include, orderBy, ...(q.home ? {} : { skip: (q.page - 1) * q.pageSize, take: q.pageSize }) }),
  ]);
  res.json({ total, page: q.page, pageSize: q.home ? total : q.pageSize, items: rows.map(serialize) });
});

partnersRouter.put("/home-order", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(500) }).parse(req.body);
  const existing = await prisma.partner.findMany({ where: { showOnHome: true }, select: { id: true } });
  const known = new Set(existing.map((p) => p.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "Список изменился. Обновите страницу");
  }
  await prisma.$transaction(ids.map((id, i) => prisma.partner.update({ where: { id }, data: { homeSortOrder: i } })));
  res.status(204).end();
});

partnersRouter.get("/:id", async (req, res) => {
  const p = await findPartner(String(req.params.id));
  const events = await prisma.eventPartner.findMany({
    where: { partnerId: p.id },
    select: { level: true, event: { select: { id: true, title: true, startDate: true, deletedAt: true } } },
    orderBy: { event: { startDate: "desc" } },
  });
  res.json({
    partner: serialize(p),
    events: events.map((e) => ({ level: e.level, id: e.event.id, title: e.event.title, inTrash: !!e.event.deletedAt })),
  });
});

async function nextHomeOrder() {
  const max = await prisma.partner.aggregate({ where: { showOnHome: true }, _max: { homeSortOrder: true } });
  return (max._max.homeSortOrder ?? -1) + 1;
}

partnersRouter.post("/", async (req, res) => {
  const data = partnerSchema.parse(req.body);
  const p = await prisma.partner.create({
    data: { ...data, homeSortOrder: data.showOnHome ? await nextHomeOrder() : 0 },
    include,
  });
  res.status(201).json({ partner: serialize(p) });
});

partnersRouter.put("/:id", async (req, res) => {
  const current = await findPartner(String(req.params.id));
  const data = partnerSchema.parse(req.body);
  const p = await prisma.partner.update({
    where: { id: current.id },
    data: { ...data, homeSortOrder: data.showOnHome && !current.showOnHome ? await nextHomeOrder() : current.homeSortOrder },
    include,
  });
  res.json({ partner: serialize(p) });
});

partnersRouter.delete("/:id", async (req, res) => {
  const current = await findPartner(String(req.params.id));
  if (current._count.events) {
    throw new HttpError(409, `Партнёр указан в мероприятиях (${current._count.events}). Сначала уберите его оттуда`);
  }
  await prisma.partner.delete({ where: { id: current.id } });
  res.status(204).end();
});

async function loadEvent(id: string, forWrite: boolean) {
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!event) throw new HttpError(404, "Мероприятие не найдено");
  if (forWrite && event.deletedAt) throw new HttpError(400, "Мероприятие в корзине. Сначала восстановите его");
  return event;
}

eventPartnersRouter.get("/", async (req, res) => {
  const event = await loadEvent(String((req.params as Record<string, string>).eventId), false);
  const rows = await prisma.eventPartner.findMany({
    where: { eventId: event.id },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    include: { partner: { select: brief } },
  });
  res.json({ partners: rows.map((r) => ({ partnerId: r.partnerId, level: r.level, partner: r.partner })) });
});

eventPartnersRouter.put("/", async (req, res) => {
  const event = await loadEvent(String((req.params as Record<string, string>).eventId), true);
  const { partners } = z
    .object({
      partners: z
        .array(z.object({ partnerId: z.string(), level: z.enum(levels) }))
        .max(300)
        .refine((v) => new Set(v.map((p) => p.partnerId)).size === v.length, "Партнёр указан дважды"),
    })
    .parse(req.body);
  if (partners.length) {
    const found = await prisma.partner.count({ where: { id: { in: partners.map((p) => p.partnerId) } } });
    if (found !== partners.length) throw new HttpError(400, "Партнёр не найден");
  }
  const counters: Record<string, number> = {};
  await prisma.$transaction([
    prisma.eventPartner.deleteMany({ where: { eventId: event.id } }),
    prisma.eventPartner.createMany({
      data: partners.map((p) => ({ ...p, eventId: event.id, sortOrder: (counters[p.level] = (counters[p.level] ?? -1) + 1) })),
    }),
  ]);
  res.status(204).end();
});
