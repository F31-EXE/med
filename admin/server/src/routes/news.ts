import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { slugify, uniqueSlug } from "../lib/slug.js";
import { formatDateOnly } from "../lib/dates.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const newsRouter = Router();

newsRouter.use(requireRole("ADMIN", "EDITOR"));

const PAGE_SIZE = 20;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const uploadUrl = z.string().regex(/^\/uploads\/[\w/.-]+\.webp$/, "Некорректная ссылка на изображение");

const newsSchema = z.object({
  title: z.string().trim().min(3, "Введите заголовок").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Только латинские буквы, цифры и дефис")
    .nullish(),
  excerpt: text(400),
  body: text(50000),
  coverUrl: uploadUrl.nullish().transform((v) => v || null),
  coverThumbUrl: uploadUrl.nullish().transform((v) => v || null),
  eventId: z.string().nullish().transform((v) => v || null),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  publishAt: z.iso.datetime({ offset: true }).nullish().transform((v) => (v ? new Date(v) : null)),
  seoTitle: text(120),
  seoDescription: text(300),
  images: z
    .array(z.object({ url: uploadUrl, thumbUrl: uploadUrl, caption: text(300) }))
    .max(60, "Не больше 60 фото в галерее")
    .default([]),
});

type NewsInput = z.infer<typeof newsSchema>;

const include = {
  event: { select: { id: true, title: true, startDate: true } },
  images: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.NewsInclude;

type NewsRow = Prisma.NewsGetPayload<{ include: typeof include }>;

function stateOf(n: Pick<NewsRow, "deletedAt" | "status" | "publishAt">, now = new Date()) {
  if (n.deletedAt) return "deleted" as const;
  if (n.status === "DRAFT") return "draft" as const;
  if (n.publishAt && n.publishAt > now) return "scheduled" as const;
  return "published" as const;
}

function serialize(n: NewsRow) {
  return {
    ...n,
    state: stateOf(n),
    purgeAt: n.deletedAt ? new Date(n.deletedAt.getTime() + config.trashTtlMs) : null,
    event: n.event ? { ...n.event, startDate: formatDateOnly(n.event.startDate) } : null,
    images: n.images.map(({ newsId: _n, sortOrder: _s, ...i }) => i),
  };
}

async function findNews(id: string) {
  const news = await prisma.news.findUnique({ where: { id }, include });
  if (!news) throw new HttpError(404, "Новость не найдена");
  return news;
}

async function checkEvent(eventId: string | null) {
  if (eventId && !(await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } }))) {
    throw new HttpError(400, "Мероприятие не найдено", { eventId: "Мероприятие не найдено" });
  }
}

async function resolveSlug(input: NewsInput, exceptId?: string) {
  const exists = async (slug: string) =>
    !!(await prisma.news.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } }));
  if (input.slug) {
    if (await exists(input.slug)) throw new HttpError(409, "Такой адрес уже занят", { slug: "Такой адрес уже занят" });
    return input.slug;
  }
  return uniqueSlug(slugify(input.title), exists);
}

function publishAtFor(input: NewsInput, current?: { status: string; publishAt: Date | null }) {
  if (input.status === "DRAFT") return input.publishAt;
  if (input.publishAt) return input.publishAt;
  if (current?.status === "PUBLISHED" && current.publishAt) return current.publishAt;
  return new Date();
}

function newsData(input: NewsInput, current?: { status: string; publishAt: Date | null }) {
  const { slug: _s, images: _i, eventId, ...rest } = input;
  return { ...rest, eventId, publishAt: publishAtFor(input, current) };
}

function imagesData(input: NewsInput) {
  return input.images.map((img, i) => ({ ...img, sortOrder: i }));
}

newsRouter.get("/", async (req, res) => {
  const q = z
    .object({
      tab: z.enum(["all", "draft", "scheduled", "published", "trash"]).default("all"),
      q: z.string().trim().max(100).optional(),
      eventId: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);

  const now = new Date();
  const tabWhere: Record<typeof q.tab, Prisma.NewsWhereInput> = {
    all: { deletedAt: null },
    draft: { deletedAt: null, status: "DRAFT" },
    scheduled: { deletedAt: null, status: "PUBLISHED", publishAt: { gt: now } },
    published: { deletedAt: null, status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
    trash: { deletedAt: { not: null } },
  };

  const where: Prisma.NewsWhereInput = {
    AND: [
      tabWhere[q.tab],
      q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { excerpt: { contains: q.q, mode: "insensitive" } }] } : {},
      q.eventId ? { eventId: q.eventId } : {},
    ],
  };

  const orderBy: Prisma.NewsOrderByWithRelationInput[] =
    q.tab === "trash"
      ? [{ deletedAt: "desc" }]
      : q.tab === "scheduled"
        ? [{ publishAt: "asc" }]
        : q.tab === "draft"
          ? [{ updatedAt: "desc" }]
          : [{ publishAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }];

  const [total, rows, counts] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({ where, include, orderBy, skip: (q.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    Promise.all(
      (["draft", "scheduled", "published", "trash"] as const).map(async (t) => [t, await prisma.news.count({ where: tabWhere[t] })] as const),
    ),
  ]);

  res.json({
    total,
    page: q.page,
    pageSize: PAGE_SIZE,
    counts: Object.fromEntries(counts),
    items: rows.map((n) => {
      const s = serialize(n);
      return {
        id: s.id,
        title: s.title,
        slug: s.slug,
        excerpt: s.excerpt,
        coverThumbUrl: s.coverThumbUrl,
        event: s.event,
        status: s.status,
        state: s.state,
        publishAt: s.publishAt,
        imagesCount: s.images.length,
        updatedAt: s.updatedAt,
        deletedAt: s.deletedAt,
        purgeAt: s.purgeAt,
      };
    }),
  });
});

newsRouter.get("/:id", async (req, res) => {
  res.json({ news: serialize(await findNews(String(req.params.id))) });
});

newsRouter.post("/", async (req, res) => {
  const input = newsSchema.parse(req.body);
  await checkEvent(input.eventId);
  const news = await prisma.news.create({
    data: {
      ...newsData(input),
      slug: await resolveSlug(input),
      createdById: req.user!.id,
      images: { create: imagesData(input) },
    },
    include,
  });
  res.status(201).json({ news: serialize(news) });
});

newsRouter.put("/:id", async (req, res) => {
  const current = await findNews(String(req.params.id));
  if (current.deletedAt) throw new HttpError(400, "Новость в корзине. Сначала восстановите её");
  const input = newsSchema.parse(req.body);
  await checkEvent(input.eventId);
  const news = await prisma.news.update({
    where: { id: current.id },
    data: {
      ...newsData(input, current),
      slug: input.slug ? await resolveSlug(input, current.id) : current.slug,
      images: { deleteMany: {}, create: imagesData(input) },
    },
    include,
  });
  res.json({ news: serialize(news) });
});

newsRouter.post("/:id/publish", async (req, res) => {
  const current = await findNews(String(req.params.id));
  if (current.deletedAt) throw new HttpError(400, "Новость в корзине");
  const { publishAt } = z
    .object({ publishAt: z.iso.datetime({ offset: true }).nullish().transform((v) => (v ? new Date(v) : null)) })
    .parse(req.body ?? {});
  const news = await prisma.news.update({
    where: { id: current.id },
    data: { status: "PUBLISHED", publishAt: publishAt ?? new Date() },
    include,
  });
  res.json({ news: serialize(news) });
});

newsRouter.post("/:id/unpublish", async (req, res) => {
  const current = await findNews(String(req.params.id));
  if (current.deletedAt) throw new HttpError(400, "Новость в корзине");
  const news = await prisma.news.update({ where: { id: current.id }, data: { status: "DRAFT" }, include });
  res.json({ news: serialize(news) });
});

newsRouter.delete("/:id", async (req, res) => {
  const current = await findNews(String(req.params.id));
  if (!current.deletedAt) await prisma.news.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
  res.status(204).end();
});

newsRouter.post("/:id/restore", async (req, res) => {
  const current = await findNews(String(req.params.id));
  const news = await prisma.news.update({ where: { id: current.id }, data: { deletedAt: null }, include });
  res.json({ news: serialize(news) });
});

export async function purgeExpiredNews() {
  const { count } = await prisma.news.deleteMany({
    where: { deletedAt: { lt: new Date(Date.now() - config.trashTtlMs) } },
  });
  if (count) console.log(`Корзина: окончательно удалено новостей — ${count}`);
}
