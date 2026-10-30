import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { fullName } from "../lib/speakers.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { imageUrlSchema } from "../lib/storage.js";

export const speakersRouter = Router();

speakersRouter.use(requireRole("ADMIN", "EDITOR"));

const PAGE_SIZE = 20;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const uploadUrl = imageUrlSchema("Некорректная ссылка на фото")
  .nullish()
  .transform((v) => v || null);

const speakerSchema = z.object({
  lastName: z.string().trim().min(1, "Введите фамилию").max(60),
  firstName: z.string().trim().min(1, "Введите имя").max(60),
  middleName: text(60),
  degree: text(200),
  position: text(300),
  city: text(100),
  bio: text(3000),
  photoUrl: uploadUrl,
  photoThumbUrl: uploadUrl,
});

const include = { _count: { select: { events: true, sessions: true } } } satisfies Prisma.SpeakerInclude;

function serialize(s: Prisma.SpeakerGetPayload<{ include: typeof include }>) {
  const { _count, ...rest } = s;
  return { ...rest, fullName: fullName(s), usage: { events: _count.events, sessions: _count.sessions } };
}

function searchWhere(q?: string): Prisma.SpeakerWhereInput {
  const words = q?.split(/\s+/).filter(Boolean).slice(0, 4) ?? [];
  return {
    AND: words.map((w) => ({
      OR: [
        { lastName: { contains: w, mode: "insensitive" } },
        { firstName: { contains: w, mode: "insensitive" } },
        { middleName: { contains: w, mode: "insensitive" } },
        { position: { contains: w, mode: "insensitive" } },
      ],
    })),
  };
}

async function findSpeaker(id: string) {
  const speaker = await prisma.speaker.findUnique({ where: { id }, include });
  if (!speaker) throw new HttpError(404, "Спикер не найден");
  return speaker;
}

speakersRouter.get("/", async (req, res) => {
  const q = z
    .object({
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(PAGE_SIZE),
    })
    .parse(req.query);
  const where = searchWhere(q.q);
  const [total, rows] = await Promise.all([
    prisma.speaker.count({ where }),
    prisma.speaker.findMany({
      where,
      include,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({ total, page: q.page, pageSize: q.pageSize, items: rows.map(serialize) });
});

speakersRouter.get("/:id", async (req, res) => {
  const speaker = await findSpeaker(String(req.params.id));
  const [events, sessions] = await Promise.all([
    prisma.eventSpeaker.findMany({
      where: { speakerId: speaker.id, event: { deletedAt: null } },
      select: { role: true, event: { select: { id: true, title: true, startDate: true } } },
      orderBy: { event: { startDate: "desc" } },
    }),
    prisma.sessionSpeaker.findMany({
      where: { speakerId: speaker.id, session: { day: { event: { deletedAt: null } } } },
      select: {
        role: true,
        session: { select: { id: true, title: true, day: { select: { date: true, event: { select: { id: true, title: true } } } } } },
      },
    }),
  ]);
  res.json({
    speaker: serialize(speaker),
    events: events.map((e) => ({ role: e.role, id: e.event.id, title: e.event.title, startDate: e.event.startDate.toISOString().slice(0, 10) })),
    sessions: sessions.map((s) => ({
      role: s.role,
      id: s.session.id,
      title: s.session.title,
      date: s.session.day.date.toISOString().slice(0, 10),
      event: s.session.day.event,
    })),
  });
});

speakersRouter.post("/", async (req, res) => {
  const data = speakerSchema.parse(req.body);
  const speaker = await prisma.speaker.create({ data, include });
  res.status(201).json({ speaker: serialize(speaker) });
});

speakersRouter.put("/:id", async (req, res) => {
  const current = await findSpeaker(String(req.params.id));
  const data = speakerSchema.parse(req.body);
  const speaker = await prisma.speaker.update({ where: { id: current.id }, data, include });
  res.json({ speaker: serialize(speaker) });
});

speakersRouter.delete("/:id", async (req, res) => {
  const current = await findSpeaker(String(req.params.id));
  const { events, sessions } = current._count;
  if (events || sessions) {
    throw new HttpError(
      409,
      `Спикер указан в мероприятиях (${events}) и сессиях программы (${sessions}). Сначала уберите его оттуда`,
    );
  }
  await prisma.speaker.delete({ where: { id: current.id } });
  res.status(204).end();
});
