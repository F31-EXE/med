import { Router } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { formatDateOnly, parseDateOnly } from "../lib/dates.js";
import {
  computeAvailability,
  createRegistration,
  formatLabels,
  formatPhone,
  participationFormats,
  registrationFieldsSchema,
  resolveFields,
  sourceLabels,
  statusLabels,
  takenWhere,
} from "../lib/registrations.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma, RegistrationStatus } from "../generated/prisma/client.js";

export const registrationsRouter = Router();

registrationsRouter.use(requireRole("ADMIN", "REGISTRATION_MANAGER"));

const statuses = ["NEW", "CONFIRMED", "REJECTED"] as const;

const filtersSchema = z.object({
  eventId: z.string().optional(),
  status: z.enum(statuses).optional(),
  format: z.enum(participationFormats).optional(),
  specialtyId: z.string().optional(),
  source: z.enum(["SITE", "MANUAL"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(100).optional(),
});

type Filters = z.infer<typeof filtersSchema>;

function tzOffsetMs(date: Date) {
  const local = new Date(date.toLocaleString("en-US", { timeZone: config.TIMEZONE }));
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return local.getTime() - utc.getTime();
}

function dayStart(value: string) {
  const d = parseDateOnly(value);
  return new Date(d.getTime() - tzOffsetMs(d));
}

function buildWhere(f: Filters, withStatus = true): Prisma.RegistrationWhereInput {
  const words = f.q?.split(/\s+/).filter(Boolean).slice(0, 4) ?? [];
  const phoneDigits = f.q?.replace(/\D/g, "") ?? "";
  return {
    AND: [
      { event: { deletedAt: null } },
      f.eventId ? { eventId: f.eventId } : {},
      withStatus && f.status ? { status: f.status } : {},
      f.format ? { format: f.format } : {},
      f.specialtyId ? { specialtyId: f.specialtyId } : {},
      f.source ? { source: f.source } : {},
      f.from ? { createdAt: { gte: dayStart(f.from) } } : {},
      f.to ? { createdAt: { lt: new Date(dayStart(f.to).getTime() + 24 * 60 * 60 * 1000) } } : {},
      ...words.map((w) => ({
        OR: [
          { lastName: { contains: w, mode: "insensitive" as const } },
          { firstName: { contains: w, mode: "insensitive" as const } },
          { middleName: { contains: w, mode: "insensitive" as const } },
          { email: { contains: w, mode: "insensitive" as const } },
          { workplace: { contains: w, mode: "insensitive" as const } },
          ...(phoneDigits.length >= 4 && /^\+?[\d\s()-]+$/.test(w) ? [{ phone: { contains: phoneDigits.slice(-10) } }] : []),
        ],
      })),
    ],
  };
}

const listInclude = { event: { select: { id: true, title: true, startDate: true } } } satisfies Prisma.RegistrationInclude;

function serialize(r: Prisma.RegistrationGetPayload<{ include: typeof listInclude }>) {
  return { ...r, event: { ...r.event, startDate: formatDateOnly(r.event.startDate) } };
}

async function statusCounts(where: Prisma.RegistrationWhereInput) {
  const rows = await prisma.registration.groupBy({ by: ["status"], where, _count: { _all: true } });
  const counts: Record<RegistrationStatus, number> = { NEW: 0, CONFIRMED: 0, REJECTED: 0 };
  for (const r of rows) counts[r.status] = r._count._all;
  return counts;
}

async function findRegistration(id: string) {
  const r = await prisma.registration.findUnique({ where: { id }, include: listInclude });
  if (!r) throw new HttpError(404, "Заявка не найдена");
  return r;
}

const eventSettingsSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  startDate: true,
  endDate: true,
  deletedAt: true,
  archivedAt: true,
  nmoPoints: true,
  registrationEnabled: true,
  registrationDeadline: true,
  maxParticipants: true,
  showRegistrationCount: true,
  registrationFormats: true,
  registrationFields: true,
  confirmationText: true,
} satisfies Prisma.EventSelect;

async function eventSummary(e: Prisma.EventGetPayload<{ select: typeof eventSettingsSelect }>) {
  const counts = await statusCounts({ eventId: e.id });
  const taken = counts.NEW + counts.CONFIRMED;
  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    status: e.status,
    startDate: formatDateOnly(e.startDate),
    endDate: formatDateOnly(e.endDate),
    nmoPoints: e.nmoPoints,
    counts,
    availability: computeAvailability(e, taken),
    settings: {
      registrationEnabled: e.registrationEnabled,
      registrationDeadline: e.registrationDeadline,
      maxParticipants: e.maxParticipants,
      showRegistrationCount: e.showRegistrationCount,
      registrationFormats: e.registrationFormats,
      registrationFields: resolveFields(e),
      confirmationText: e.confirmationText,
    },
  };
}

registrationsRouter.get("/events", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { deletedAt: null },
    select: eventSettingsSelect,
    orderBy: { startDate: "desc" },
  });
  res.json({ events: await Promise.all(events.map(eventSummary)) });
});

registrationsRouter.get("/events/:eventId", async (req, res) => {
  const e = await prisma.event.findUnique({ where: { id: String(req.params.eventId) }, select: eventSettingsSelect });
  if (!e || e.deletedAt) throw new HttpError(404, "Мероприятие не найдено");
  res.json({ event: await eventSummary(e) });
});

registrationsRouter.put("/events/:eventId/settings", async (req, res) => {
  const e = await prisma.event.findUnique({ where: { id: String(req.params.eventId) }, select: eventSettingsSelect });
  if (!e || e.deletedAt) throw new HttpError(404, "Мероприятие не найдено");
  const body = z
    .object({
      registrationEnabled: z.boolean(),
      registrationDeadline: z.iso.datetime({ offset: true }).nullish().transform((v) => (v ? new Date(v) : null)),
      maxParticipants: z.number().int().min(1, "Не меньше 1").max(1_000_000).nullish().transform((v) => v ?? null),
      showRegistrationCount: z.boolean(),
      registrationFormats: z.array(z.enum(participationFormats)).min(1, "Выберите хотя бы один формат").max(4),
      registrationFields: registrationFieldsSchema,
      confirmationText: z.string().trim().max(5000).nullish().transform((v) => v || null),
    })
    .parse(req.body);

  const updated = await prisma.event.update({
    where: { id: e.id },
    data: { ...body, registrationFormats: [...new Set(body.registrationFormats)] },
    select: eventSettingsSelect,
  });
  const summary = await eventSummary(updated);
  const taken = summary.counts.NEW + summary.counts.CONFIRMED;
  res.json({
    event: summary,
    warning: updated.maxParticipants !== null && taken > updated.maxParticipants
      ? `Заявок уже больше лимита: ${taken} из ${updated.maxParticipants}. Новые заявки с сайта приниматься не будут`
      : null,
  });
});

registrationsRouter.get("/", async (req, res) => {
  const q = filtersSchema
    .extend({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(10).max(100).default(50),
    })
    .parse(req.query);
  const where = buildWhere(q);
  const [total, rows, counts] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: listInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    statusCounts(buildWhere(q, false)),
  ]);
  res.json({ total, page: q.page, pageSize: q.pageSize, counts, items: rows.map(serialize) });
});

registrationsRouter.get("/export", async (req, res) => {
  const f = filtersSchema.parse(req.query);
  const rows = await prisma.registration.findMany({
    where: buildWhere(f),
    include: listInclude,
    orderBy: { createdAt: "asc" },
    take: 50_000,
  });
  const event = f.eventId ? await prisma.event.findUnique({ where: { id: f.eventId }, select: { slug: true, title: true } }) : null;
  const withEvent = !f.eventId;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Media Expo Group";
  wb.created = new Date();
  const ws = wb.addWorksheet("Заявки", { views: [{ state: "frozen", ySplit: 1 }] });

  const dateTime = (d: Date) =>
    d.toLocaleString("ru-RU", { timeZone: config.TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  ws.columns = [
    { header: "№", key: "n", width: 6 },
    ...(withEvent ? [{ header: "Мероприятие", key: "event", width: 40 }] : []),
    { header: "Дата заявки", key: "createdAt", width: 18 },
    { header: "Статус", key: "status", width: 14 },
    { header: "Фамилия", key: "lastName", width: 18 },
    { header: "Имя", key: "firstName", width: 14 },
    { header: "Отчество", key: "middleName", width: 18 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Телефон", key: "phone", width: 20 },
    { header: "Специальность", key: "specialty", width: 24 },
    { header: "Место работы", key: "workplace", width: 32 },
    { header: "Должность", key: "position", width: 22 },
    { header: "Город", key: "city", width: 16 },
    { header: "Формат участия", key: "format", width: 15 },
    { header: "Согласие на ПДн", key: "consentAt", width: 18 },
    { header: "Рассылка", key: "mailing", width: 10 },
    { header: "Источник", key: "source", width: 10 },
    { header: "Комментарий менеджера", key: "comment", width: 32 },
  ];

  rows.forEach((r, i) =>
    ws.addRow({
      n: i + 1,
      event: r.event.title,
      createdAt: dateTime(r.createdAt),
      status: statusLabels[r.status],
      lastName: r.lastName,
      firstName: r.firstName,
      middleName: r.middleName ?? "",
      email: r.email,
      phone: formatPhone(r.phone),
      specialty: r.specialtyName,
      workplace: r.workplace ?? "",
      position: r.position ?? "",
      city: r.city,
      format: formatLabels[r.format],
      consentAt: dateTime(r.consentAt),
      mailing: r.consentMailing ? "да" : "нет",
      source: sourceLabels[r.source],
      comment: r.managerComment ?? "",
    }),
  );

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FB" } };
  header.alignment = { vertical: "middle", wrapText: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: config.TIMEZONE });
  const name = `registrations-${event?.slug ?? "all"}-${stamp}.xlsx`;
  const ruName = `Заявки — ${event?.title ?? "все мероприятия"} — ${stamp}.xlsx`.replace(/[\\/:*?"<>|]/g, " ");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(ruName)}`);
  res.setHeader("Cache-Control", "no-store");
  await wb.xlsx.write(res);
  res.end();
});

registrationsRouter.get("/:id", async (req, res) => {
  res.json({ registration: serialize(await findRegistration(String(req.params.id))) });
});

registrationsRouter.post("/", async (req, res) => {
  const { eventId, ...body } = z.object({ eventId: z.string().min(1, "Выберите мероприятие") }).passthrough().parse(req.body);
  const created = await createRegistration(eventId, body, { source: "MANUAL", userId: req.user!.id, enforceAvailability: false });
  res.status(201).json({ registration: serialize(await findRegistration(created.id)) });
});

registrationsRouter.patch("/:id", async (req, res) => {
  const current = await findRegistration(String(req.params.id));
  const body = z
    .object({
      status: z.enum(statuses).optional(),
      managerComment: z.string().trim().max(2000).nullish().transform((v) => (v === undefined ? undefined : v || null)),
    })
    .parse(req.body);

  if (body.status && body.status !== current.status && body.status !== "REJECTED" && current.status === "REJECTED") {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: current.eventId } });
    const taken = await prisma.registration.count({ where: takenWhere(event.id) });
    if (event.maxParticipants !== null && taken >= event.maxParticipants) {
      throw new HttpError(409, `Все места заняты (${taken} из ${event.maxParticipants}). Увеличьте лимит в настройках регистрации`);
    }
  }

  const statusChanged = body.status && body.status !== current.status;
  const updated = await prisma.registration.update({
    where: { id: current.id },
    data: {
      ...body,
      ...(statusChanged ? { statusChangedAt: new Date(), statusChangedById: req.user!.id } : {}),
    },
    include: listInclude,
  });
  res.json({ registration: serialize(updated) });
});

registrationsRouter.post("/bulk-status", async (req, res) => {
  const { ids, status } = z.object({ ids: z.array(z.string()).min(1).max(1000), status: z.enum(statuses) }).parse(req.body);
  const { count } = await prisma.registration.updateMany({
    where: { id: { in: ids }, status: { not: status } },
    data: { status, statusChangedAt: new Date(), statusChangedById: req.user!.id },
  });
  res.json({ updated: count });
});

registrationsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const current = await findRegistration(String(req.params.id));
  await prisma.registration.delete({ where: { id: current.id } });
  res.status(204).end();
});
