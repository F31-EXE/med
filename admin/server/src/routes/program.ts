import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { formatDateOnly, parseDateOnly } from "../lib/dates.js";
import { speakerBrief, speakerBriefSelect } from "../lib/speakers.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const programRouter = Router({ mergeParams: true });
export const eventSpeakersRouter = Router({ mergeParams: true });

programRouter.use(requireRole("ADMIN", "EDITOR"));
eventSpeakersRouter.use(requireRole("ADMIN", "EDITOR"));

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const sessionSchema = z
  .object({
    dayId: z.string().min(1, "Выберите день"),
    hallId: z.string().nullish().transform((v) => v || null),
    kind: z.enum(["SESSION", "BREAK"]).default("SESSION"),
    startTime: time,
    endTime: time,
    title: z.string().trim().min(1, "Введите название").max(300),
    description: optText(5000),
    nmo: z.boolean().default(false),
    speakers: z
      .array(z.object({ speakerId: z.string(), role: z.enum(["MODERATOR", "SPEAKER"]) }))
      .max(30)
      .default([]),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "Окончание позже начала" })
  .refine((v) => new Set(v.speakers.map((s) => s.speakerId)).size === v.speakers.length, {
    path: ["speakers"],
    message: "Спикер указан дважды",
  });

const idsSchema = z.object({ ids: z.array(z.string()).max(500) });

function eventId(req: { params: Record<string, unknown> }) {
  return String(req.params.eventId);
}

async function loadEvent(id: string, forWrite: boolean) {
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, startDate: true, endDate: true, deletedAt: true },
  });
  if (!event) throw new HttpError(404, "Мероприятие не найдено");
  if (forWrite && event.deletedAt) throw new HttpError(400, "Мероприятие в корзине. Сначала восстановите его");
  return event;
}

async function loadDay(evId: string, dayId: string) {
  const day = await prisma.programDay.findFirst({ where: { id: dayId, eventId: evId } });
  if (!day) throw new HttpError(404, "День программы не найден", { dayId: "День не найден" });
  return day;
}

async function loadHall(evId: string, hallId: string) {
  const hall = await prisma.hall.findFirst({ where: { id: hallId, eventId: evId } });
  if (!hall) throw new HttpError(404, "Зал не найден", { hallId: "Зал не найден" });
  return hall;
}

async function loadSession(evId: string, sessionId: string) {
  const session = await prisma.programSession.findFirst({ where: { id: sessionId, day: { eventId: evId } } });
  if (!session) throw new HttpError(404, "Сессия не найдена");
  return session;
}

async function checkSpeakers(ids: string[]) {
  if (!ids.length) return;
  const found = await prisma.speaker.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new HttpError(400, "Спикер не найден", { speakers: "Спикер не найден" });
}

function checkDateInEvent(event: { startDate: Date; endDate: Date }, date: string) {
  const d = parseDateOnly(date);
  if (d < event.startDate || d > event.endDate) {
    throw new HttpError(400, "Дата вне дат проведения мероприятия", {
      date: `Дата должна быть с ${formatDateOnly(event.startDate)} по ${formatDateOnly(event.endDate)}`,
    });
  }
  return d;
}

const sessionInclude = {
  speakers: { orderBy: { sortOrder: "asc" }, include: { speaker: { select: speakerBriefSelect } } },
} satisfies Prisma.ProgramSessionInclude;

function serializeSession(s: Prisma.ProgramSessionGetPayload<{ include: typeof sessionInclude }>) {
  const { speakers, dayId: _d, sortOrder: _s, ...rest } = s;
  return {
    ...rest,
    dayId: s.dayId,
    speakers: speakers.map((sp) => ({ speakerId: sp.speakerId, role: sp.role, speaker: speakerBrief(sp.speaker) })),
  };
}

programRouter.get("/", async (req, res) => {
  const event = await loadEvent(eventId(req), false);
  const [halls, days] = await Promise.all([
    prisma.hall.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" } }),
    prisma.programDay.findMany({
      where: { eventId: event.id },
      orderBy: { date: "asc" },
      include: { sessions: { orderBy: { sortOrder: "asc" }, include: sessionInclude } },
    }),
  ]);
  res.json({
    event: { startDate: formatDateOnly(event.startDate), endDate: formatDateOnly(event.endDate) },
    halls: halls.map(({ eventId: _e, ...h }) => h),
    days: days.map((d) => ({
      id: d.id,
      date: formatDateOnly(d.date),
      title: d.title,
      sessions: d.sessions.map(serializeSession),
    })),
  });
});

programRouter.post("/days", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const body = z.object({ date: dateOnly, title: optText(200) }).parse(req.body);
  const date = checkDateInEvent(event, body.date);
  if (await prisma.programDay.findFirst({ where: { eventId: event.id, date } })) {
    throw new HttpError(409, "Этот день уже добавлен", { date: "Этот день уже добавлен" });
  }
  const day = await prisma.programDay.create({ data: { eventId: event.id, date, title: body.title } });
  res.status(201).json({ day: { id: day.id, date: body.date, title: day.title } });
});

programRouter.patch("/days/:dayId", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const day = await loadDay(event.id, String(req.params.dayId));
  const body = z.object({ date: dateOnly.optional(), title: optText(200) }).parse(req.body);
  const date = body.date ? checkDateInEvent(event, body.date) : undefined;
  if (date && (await prisma.programDay.findFirst({ where: { eventId: event.id, date, NOT: { id: day.id } } }))) {
    throw new HttpError(409, "Этот день уже добавлен", { date: "Этот день уже добавлен" });
  }
  const updated = await prisma.programDay.update({ where: { id: day.id }, data: { date, title: body.title } });
  res.json({ day: { id: updated.id, date: formatDateOnly(updated.date), title: updated.title } });
});

programRouter.delete("/days/:dayId", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const day = await loadDay(event.id, String(req.params.dayId));
  await prisma.programDay.delete({ where: { id: day.id } });
  res.status(204).end();
});

programRouter.put("/days/:dayId/order", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const day = await loadDay(event.id, String(req.params.dayId));
  const { ids } = idsSchema.parse(req.body);
  const existing = await prisma.programSession.findMany({ where: { dayId: day.id }, select: { id: true } });
  const known = new Set(existing.map((s) => s.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "Программа изменилась. Обновите страницу");
  }
  await prisma.$transaction(ids.map((id, i) => prisma.programSession.update({ where: { id }, data: { sortOrder: i } })));
  res.status(204).end();
});

programRouter.post("/days/:dayId/sort-by-time", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const day = await loadDay(event.id, String(req.params.dayId));
  const sessions = await prisma.programSession.findMany({
    where: { dayId: day.id },
    include: { hall: { select: { sortOrder: true } } },
  });
  sessions.sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      (a.hall?.sortOrder ?? 999) - (b.hall?.sortOrder ?? 999) ||
      a.sortOrder - b.sortOrder,
  );
  await prisma.$transaction(sessions.map((s, i) => prisma.programSession.update({ where: { id: s.id }, data: { sortOrder: i } })));
  res.status(204).end();
});

programRouter.post("/halls", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const { name } = z.object({ name: z.string().trim().min(1, "Введите название").max(100) }).parse(req.body);
  const max = await prisma.hall.aggregate({ where: { eventId: event.id }, _max: { sortOrder: true } });
  const hall = await prisma.hall.create({ data: { eventId: event.id, name, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  res.status(201).json({ hall: { id: hall.id, name: hall.name, sortOrder: hall.sortOrder } });
});

programRouter.patch("/halls/:hallId", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const hall = await loadHall(event.id, String(req.params.hallId));
  const { name } = z.object({ name: z.string().trim().min(1, "Введите название").max(100) }).parse(req.body);
  const updated = await prisma.hall.update({ where: { id: hall.id }, data: { name } });
  res.json({ hall: { id: updated.id, name: updated.name, sortOrder: updated.sortOrder } });
});

programRouter.delete("/halls/:hallId", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const hall = await loadHall(event.id, String(req.params.hallId));
  await prisma.hall.delete({ where: { id: hall.id } });
  res.status(204).end();
});

programRouter.put("/halls/order", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const { ids } = idsSchema.parse(req.body);
  const existing = await prisma.hall.findMany({ where: { eventId: event.id }, select: { id: true } });
  const known = new Set(existing.map((h) => h.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "Список залов изменился. Обновите страницу");
  }
  await prisma.$transaction(ids.map((id, i) => prisma.hall.update({ where: { id }, data: { sortOrder: i } })));
  res.status(204).end();
});

programRouter.post("/sessions", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const body = sessionSchema.parse(req.body);
  await loadDay(event.id, body.dayId);
  if (body.hallId) await loadHall(event.id, body.hallId);
  await checkSpeakers(body.speakers.map((s) => s.speakerId));

  const max = await prisma.programSession.aggregate({ where: { dayId: body.dayId }, _max: { sortOrder: true } });
  const { speakers, ...data } = body;
  const session = await prisma.programSession.create({
    data: {
      ...data,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      speakers: { create: speakers.map((s, i) => ({ ...s, sortOrder: i })) },
    },
    include: sessionInclude,
  });
  res.status(201).json({ session: serializeSession(session) });
});

programRouter.put("/sessions/:sessionId", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const current = await loadSession(event.id, String(req.params.sessionId));
  const body = sessionSchema.parse(req.body);
  await loadDay(event.id, body.dayId);
  if (body.hallId) await loadHall(event.id, body.hallId);
  await checkSpeakers(body.speakers.map((s) => s.speakerId));

  let sortOrder = current.sortOrder;
  if (body.dayId !== current.dayId) {
    const max = await prisma.programSession.aggregate({ where: { dayId: body.dayId }, _max: { sortOrder: true } });
    sortOrder = (max._max.sortOrder ?? -1) + 1;
  }

  const { speakers, ...data } = body;
  const session = await prisma.programSession.update({
    where: { id: current.id },
    data: {
      ...data,
      sortOrder,
      speakers: { deleteMany: {}, create: speakers.map((s, i) => ({ ...s, sortOrder: i })) },
    },
    include: sessionInclude,
  });
  res.json({ session: serializeSession(session) });
});

programRouter.delete("/sessions/:sessionId", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const session = await loadSession(event.id, String(req.params.sessionId));
  await prisma.programSession.delete({ where: { id: session.id } });
  res.status(204).end();
});

eventSpeakersRouter.get("/", async (req, res) => {
  const event = await loadEvent(eventId(req), false);
  const [speakers, programSpeakers] = await Promise.all([
    prisma.eventSpeaker.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
      include: { speaker: { select: speakerBriefSelect } },
    }),
    prisma.speaker.findMany({
      where: { sessions: { some: { session: { day: { eventId: event.id } } } } },
      select: speakerBriefSelect,
      orderBy: { lastName: "asc" },
    }),
  ]);
  res.json({
    speakers: speakers.map((s) => ({ speakerId: s.speakerId, role: s.role, speaker: speakerBrief(s.speaker) })),
    programSpeakers: programSpeakers.map(speakerBrief),
  });
});

eventSpeakersRouter.put("/", async (req, res) => {
  const event = await loadEvent(eventId(req), true);
  const { speakers } = z
    .object({
      speakers: z
        .array(z.object({ speakerId: z.string(), role: z.enum(["CHAIR", "CO_CHAIR", "COMMITTEE", "SPEAKER"]) }))
        .max(300)
        .refine((v) => new Set(v.map((s) => s.speakerId)).size === v.length, "Спикер указан дважды"),
    })
    .parse(req.body);
  await checkSpeakers(speakers.map((s) => s.speakerId));

  await prisma.$transaction([
    prisma.eventSpeaker.deleteMany({ where: { eventId: event.id } }),
    prisma.eventSpeaker.createMany({ data: speakers.map((s, i) => ({ ...s, eventId: event.id, sortOrder: i })) }),
  ]);
  res.status(204).end();
});
