import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { slugify, uniqueSlug } from "../lib/slug.js";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "../lib/dates.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const eventsRouter = Router();

eventsRouter.use(requireRole("ADMIN", "EDITOR"));

const PAGE_SIZE = 20;

const formats = ["CONGRESS", "CONFERENCE", "SEMINAR", "EXHIBITION", "ONLINE_SYMPOSIUM"] as const;
const modes = ["OFFLINE", "ONLINE", "HYBRID"] as const;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const int = (min: number, max: number) =>
  z
    .number({ error: "Введите число" })
    .int("Введите целое число")
    .min(min, `Не меньше ${min}`)
    .max(max, `Не больше ${max}`)
    .nullish()
    .transform((v) => v ?? null);

const dateOnly = z.string({ error: "Укажите дату" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату");

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Введите название").max(200),
    slug: z
      .string()
      .trim()
      .max(80)
      .regex(/^[a-z0-9-]*$/, "Только латинские буквы, цифры и дефис")
      .nullish(),
    subtitle: text(300),
    format: z.enum(formats, { error: "Выберите формат" }),
    attendanceMode: z.enum(modes).default("OFFLINE"),
    startDate: dateOnly,
    endDate: dateOnly,
    cityId: z.string().nullish().transform((v) => v || null),
    directionIds: z.array(z.string()).max(10).default([]),
    nmoPoints: int(0, 100),
    expectedParticipants: int(0, 1_000_000),
    description: text(20000),
    keyFacts: z
      .array(z.object({ value: z.string().trim().min(1).max(30), label: z.string().trim().min(1).max(100) }))
      .max(8)
      .default([]),
    organizers: text(2000),
    venueName: text(200),
    venueAddress: text(300),
    venueHowToGet: text(2000),
    venueParking: text(1000),
    venueAccommodation: text(2000),
    venueLat: z.number().min(-90).max(90).nullish().transform((v) => v ?? null),
    venueLng: z.number().min(-180).max(180).nullish().transform((v) => v ?? null),
    registrationEnabled: z.boolean().default(true),
    registrationDeadline: z.iso.datetime({ offset: true }).nullish().transform((v) => (v ? new Date(v) : null)),
    maxParticipants: int(1, 1_000_000),
    showRegistrationCount: z.boolean().default(false),
    seoTitle: text(120),
    seoDescription: text(300),
    tariffs: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Введите название тарифа").max(100),
          audience: text(200),
          price: int(0, 10_000_000),
          includes: text(2000),
        }),
      )
      .max(4, "Не больше четырёх тарифов")
      .default([]),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Окончание не раньше начала" });

type EventInput = z.infer<typeof eventSchema>;

const detailInclude = {
  city: { select: { id: true, name: true } },
  directions: { select: { id: true, name: true }, orderBy: { name: "asc" } },
  tariffs: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.EventInclude;

type EventDetail = Prisma.EventGetPayload<{ include: typeof detailInclude }>;

function stateOf(e: { deletedAt: Date | null; archivedAt: Date | null; endDate: Date }) {
  if (e.deletedAt) return "deleted" as const;
  if (e.archivedAt || e.endDate < todayDateOnly()) return "archived" as const;
  return "upcoming" as const;
}

function serialize(e: EventDetail) {
  return {
    ...e,
    startDate: formatDateOnly(e.startDate),
    endDate: formatDateOnly(e.endDate),
    state: stateOf(e),
    purgeAt: e.deletedAt ? new Date(e.deletedAt.getTime() + config.trashTtlMs) : null,
    directionIds: e.directions.map((d) => d.id),
    tariffs: e.tariffs.map(({ eventId: _e, sortOrder: _s, ...t }) => t),
  };
}

async function findEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id }, include: detailInclude });
  if (!event) throw new HttpError(404, "Мероприятие не найдено");
  return event;
}

async function checkRefs(input: EventInput) {
  if (input.cityId && !(await prisma.city.findUnique({ where: { id: input.cityId } }))) {
    throw new HttpError(400, "Город не найден", { cityId: "Город не найден" });
  }
  if (input.directionIds.length) {
    const found = await prisma.direction.count({ where: { id: { in: input.directionIds } } });
    if (found !== new Set(input.directionIds).size) {
      throw new HttpError(400, "Направление не найдено", { directionIds: "Направление не найдено" });
    }
  }
}

async function resolveSlug(input: EventInput, exceptId?: string) {
  const exists = async (slug: string) =>
    !!(await prisma.event.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } }));

  if (input.slug) {
    if (await exists(input.slug)) throw new HttpError(409, "Такой адрес уже занят", { slug: "Такой адрес уже занят" });
    return input.slug;
  }
  return uniqueSlug(slugify(`${input.title} ${input.startDate.slice(0, 4)}`), exists);
}

function eventData(input: EventInput, mode: "create" | "update") {
  const { slug: _slug, directionIds: _d, tariffs: _t, cityId, startDate, endDate, ...rest } = input;
  return {
    ...rest,
    startDate: parseDateOnly(startDate),
    endDate: parseDateOnly(endDate),
    city: cityId ? { connect: { id: cityId } } : mode === "update" ? { disconnect: true } : undefined,
  };
}

function tariffData(input: EventInput) {
  return input.tariffs.map((t, i) => ({ ...t, sortOrder: i }));
}

eventsRouter.get("/", async (req, res) => {
  const q = z
    .object({
      tab: z.enum(["upcoming", "archive", "trash"]).default("upcoming"),
      q: z.string().trim().max(100).optional(),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
      format: z.enum(formats).optional(),
      directionId: z.string().optional(),
      cityId: z.string().optional(),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);

  const today = todayDateOnly();
  const tabWhere: Record<typeof q.tab, Prisma.EventWhereInput> = {
    upcoming: { deletedAt: null, archivedAt: null, endDate: { gte: today } },
    archive: { deletedAt: null, OR: [{ archivedAt: { not: null } }, { endDate: { lt: today } }] },
    trash: { deletedAt: { not: null } },
  };
  const orderBy: Record<typeof q.tab, Prisma.EventOrderByWithRelationInput> = {
    upcoming: { startDate: "asc" },
    archive: { startDate: "desc" },
    trash: { deletedAt: "desc" },
  };

  const where: Prisma.EventWhereInput = {
    AND: [
      tabWhere[q.tab],
      q.q ? { title: { contains: q.q, mode: "insensitive" } } : {},
      q.status ? { status: q.status } : {},
      q.format ? { format: q.format } : {},
      q.directionId ? { directions: { some: { id: q.directionId } } } : {},
      q.cityId ? { cityId: q.cityId } : {},
      q.year
        ? {
            startDate: { lte: parseDateOnly(`${q.year}-12-31`) },
            endDate: { gte: parseDateOnly(`${q.year}-01-01`) },
          }
        : {},
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: orderBy[q.tab],
      skip: (q.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: detailInclude,
    }),
  ]);

  res.json({
    total,
    page: q.page,
    pageSize: PAGE_SIZE,
    items: rows.map((e) => {
      const s = serialize(e);
      return {
        id: s.id,
        title: s.title,
        slug: s.slug,
        format: s.format,
        attendanceMode: s.attendanceMode,
        status: s.status,
        state: s.state,
        startDate: s.startDate,
        endDate: s.endDate,
        city: s.city,
        directions: s.directions,
        nmoPoints: s.nmoPoints,
        venueName: s.venueName,
        deletedAt: s.deletedAt,
        purgeAt: s.purgeAt,
        updatedAt: s.updatedAt,
      };
    }),
  });
});

eventsRouter.get("/options", async (req, res) => {
  const { q, ids } = z.object({ q: z.string().trim().max(100).optional(), ids: z.string().max(2000).optional() }).parse(req.query);
  const rows = await prisma.event.findMany({
    where: {
      deletedAt: null,
      OR: [
        q ? { title: { contains: q, mode: "insensitive" } } : {},
        ...(ids ? [{ id: { in: ids.split(",").filter(Boolean) } }] : []),
      ],
    },
    select: { id: true, title: true, startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
    take: 30,
  });
  res.json({ items: rows.map((e) => ({ ...e, startDate: formatDateOnly(e.startDate), endDate: formatDateOnly(e.endDate) })) });
});

eventsRouter.get("/:id", async (req, res) => {
  res.json({ event: serialize(await findEvent(req.params.id)) });
});

eventsRouter.post("/", async (req, res) => {
  const input = eventSchema.parse(req.body);
  await checkRefs(input);
  const event = await prisma.event.create({
    data: {
      ...eventData(input, "create"),
      slug: await resolveSlug(input),
      createdById: req.user!.id,
      directions: { connect: input.directionIds.map((id) => ({ id })) },
      tariffs: { create: tariffData(input) },
    },
    include: detailInclude,
  });
  res.status(201).json({ event: serialize(event) });
});

eventsRouter.put("/:id", async (req, res) => {
  const current = await findEvent(req.params.id);
  if (current.deletedAt) throw new HttpError(400, "Мероприятие в корзине. Сначала восстановите его");
  const input = eventSchema.parse(req.body);
  await checkRefs(input);

  const event = await prisma.event.update({
    where: { id: current.id },
    data: {
      ...eventData(input, "update"),
      slug: input.slug ? await resolveSlug(input, current.id) : current.slug,
      directions: { set: input.directionIds.map((id) => ({ id })) },
      tariffs: { deleteMany: {}, create: tariffData(input) },
    },
    include: detailInclude,
  });
  res.json({ event: serialize(event) });
});

eventsRouter.post("/:id/status", async (req, res) => {
  const { status } = z.object({ status: z.enum(["DRAFT", "PUBLISHED"]) }).parse(req.body);
  const current = await findEvent(req.params.id);
  if (current.deletedAt) throw new HttpError(400, "Мероприятие в корзине");
  const event = await prisma.event.update({
    where: { id: current.id },
    data: { status, publishedAt: status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt },
    include: detailInclude,
  });
  res.json({ event: serialize(event) });
});

eventsRouter.post("/:id/archive", async (req, res) => {
  const { archived } = z.object({ archived: z.boolean() }).parse(req.body);
  const current = await findEvent(req.params.id);
  if (current.deletedAt) throw new HttpError(400, "Мероприятие в корзине");
  const event = await prisma.event.update({
    where: { id: current.id },
    data: { archivedAt: archived ? new Date() : null },
    include: detailInclude,
  });
  res.json({ event: serialize(event) });
});

eventsRouter.post("/:id/copy", async (req, res) => {
  const src = await findEvent(req.params.id);
  const {
    id: _id,
    slug: _slug,
    city: _city,
    directions,
    tariffs,
    createdAt: _c,
    updatedAt: _u,
    archivedAt: _a,
    deletedAt: _d,
    publishedAt: _p,
    createdById: _by,
    status: _s,
    keyFacts,
    registrationFields,
    ...rest
  } = src;

  const [halls, speakers, partners] = await Promise.all([
    prisma.hall.findMany({ where: { eventId: src.id } }),
    prisma.eventSpeaker.findMany({ where: { eventId: src.id } }),
    prisma.eventPartner.findMany({ where: { eventId: src.id } }),
  ]);
  const title = `${src.title} (копия)`;
  const slug = await uniqueSlug(`${src.slug}-copy`.slice(0, 80), async (s) => !!(await prisma.event.findUnique({ where: { slug: s } })));

  const event = await prisma.event.create({
    data: {
      ...rest,
      title,
      slug,
      keyFacts: keyFacts ?? [],
      registrationFields: registrationFields ?? {},
      status: "DRAFT",
      createdById: req.user!.id,
      directions: { connect: directions.map((d) => ({ id: d.id })) },
      tariffs: { create: tariffs.map(({ id: _tid, eventId: _eid, ...t }) => t) },
      halls: { create: halls.map((h) => ({ name: h.name, sortOrder: h.sortOrder })) },
      speakers: { create: speakers.map((s) => ({ speakerId: s.speakerId, role: s.role, sortOrder: s.sortOrder })) },
      partners: { create: partners.map((p) => ({ partnerId: p.partnerId, level: p.level, sortOrder: p.sortOrder })) },
    },
    include: detailInclude,
  });
  res.status(201).json({ event: serialize(event) });
});

eventsRouter.delete("/:id", async (req, res) => {
  const current = await findEvent(req.params.id);
  if (!current.deletedAt) {
    await prisma.event.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
  }
  res.status(204).end();
});

eventsRouter.post("/:id/restore", async (req, res) => {
  const current = await findEvent(req.params.id);
  const event = await prisma.event.update({ where: { id: current.id }, data: { deletedAt: null }, include: detailInclude });
  res.json({ event: serialize(event) });
});

export async function purgeExpiredEvents() {
  const { count } = await prisma.event.deleteMany({
    where: { deletedAt: { lt: new Date(Date.now() - config.trashTtlMs) } },
  });
  if (count) console.log(`Корзина: окончательно удалено мероприятий — ${count}`);
}
