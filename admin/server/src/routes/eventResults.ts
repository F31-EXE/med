import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { todayDateOnly } from "../lib/dates.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const eventResultsRouter = Router({ mergeParams: true });

eventResultsRouter.use(requireRole("ADMIN", "EDITOR"));

const uploadUrl = z.string().regex(/^\/uploads\/[\w/.-]+\.webp$/, "Некорректная ссылка на изображение");

const resultsSchema = z.object({
  resultsText: z
    .string()
    .max(20000, "Текст слишком длинный")
    .nullish()
    .transform((v) => (v?.trim() ? v : null)),
  resultsFacts: z
    .array(
      z.object({
        value: z.string({ error: "Введите цифру" }).trim().min(1, "Введите цифру").max(30),
        label: z.string({ error: "Введите подпись" }).trim().min(1, "Введите подпись").max(100),
      }),
    )
    .max(8, "Не больше восьми цифр")
    .default([]),
  resultsLinks: z
    .array(
      z.object({
        title: z.string({ error: "Введите название" }).trim().min(1, "Введите название").max(200),
        url: z
          .string({ error: "Введите ссылку" })
          .trim()
          .transform((v, ctx) => {
            const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
            try {
              const u = new URL(withScheme);
              if (!u.hostname.includes(".")) throw new Error();
              return u.toString();
            } catch {
              ctx.addIssue({ code: "custom", message: "Введите ссылку, например rutube.ru/video/…" });
              return v;
            }
          }),
      }),
    )
    .max(30, "Не больше 30 ссылок")
    .default([]),
  images: z
    .array(z.object({ url: uploadUrl, thumbUrl: uploadUrl, caption: z.string().trim().max(300).nullish().transform((v) => v || null) }))
    .max(100, "Не больше 100 фото")
    .default([]),
});

function eventId(req: { params: Record<string, unknown> }) {
  return String(req.params.eventId);
}

async function load(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      deletedAt: true,
      archivedAt: true,
      endDate: true,
      resultsText: true,
      resultsFacts: true,
      resultsLinks: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, thumbUrl: true, caption: true } },
    },
  });
  if (!event) throw new HttpError(404, "Мероприятие не найдено");
  return event;
}

function serialize(e: Awaited<ReturnType<typeof load>>) {
  return {
    resultsText: e.resultsText,
    resultsFacts: e.resultsFacts,
    resultsLinks: e.resultsLinks,
    images: e.images,
    isPast: !!e.archivedAt || e.endDate < todayDateOnly(),
  };
}

eventResultsRouter.get("/", async (req, res) => {
  res.json({ results: serialize(await load(eventId(req))) });
});

eventResultsRouter.put("/", async (req, res) => {
  const current = await load(eventId(req));
  if (current.deletedAt) throw new HttpError(400, "Мероприятие в корзине. Сначала восстановите его");
  const { images, ...data } = resultsSchema.parse(req.body);
  await prisma.event.update({
    where: { id: current.id },
    data: {
      ...data,
      images: { deleteMany: {}, create: images.map((img, i) => ({ ...img, sortOrder: i })) },
    },
  });
  res.json({ results: serialize(await load(current.id)) });
});
