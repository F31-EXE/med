import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { formatDateOnly, todayDateOnly } from "../lib/dates.js";
import { sendMail } from "../lib/mailer.js";
import { speakerBrief, speakerBriefSelect } from "../lib/speakers.js";
import { computeAvailability, createRegistration, formatLabels, formatPhone, resolveFields, takenWhere } from "../lib/registrations.js";
import { getSiteSettings } from "./settings.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const publicEventsRouter = Router();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Слишком много заявок. Попробуйте позже" },
});

const include = {
  city: { select: { name: true } },
  directions: { select: { name: true }, orderBy: { name: "asc" } },
  tariffs: { orderBy: { sortOrder: "asc" }, select: { name: true, audience: true, price: true, includes: true } },
  halls: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
  programDays: {
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      title: true,
      sessions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          hallId: true,
          kind: true,
          startTime: true,
          endTime: true,
          title: true,
          description: true,
          nmo: true,
          speakers: { orderBy: { sortOrder: "asc" }, select: { role: true, speaker: { select: speakerBriefSelect } } },
        },
      },
    },
  },
  speakers: { orderBy: { sortOrder: "asc" }, select: { role: true, speaker: { select: { ...speakerBriefSelect, bio: true } } } },
  partners: { orderBy: [{ level: "asc" }, { sortOrder: "asc" }], select: { level: true, partner: { select: { name: true, url: true, logoThumbUrl: true } } } },
  documents: {
    orderBy: { eventSortOrder: "asc" },
    select: { title: true, description: true, publicId: true, extension: true, size: true, fileUpdatedAt: true, eventSection: true },
  },
  images: { orderBy: { sortOrder: "asc" }, select: { url: true, thumbUrl: true, caption: true } },
} satisfies Prisma.EventInclude;

async function findPublished(slug: string) {
  const event = await prisma.event.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, include });
  if (!event) throw new HttpError(404, "Мероприятие не найдено");
  return event;
}

publicEventsRouter.get("/:slug", async (req, res) => {
  const e = await findPublished(String(req.params.slug));
  const taken = await prisma.registration.count({ where: takenWhere(e.id) });
  const availability = computeAvailability(e, taken);
  const isPast = !!e.archivedAt || e.endDate < todayDateOnly();
  const [specialties, others] = await Promise.all([
    availability.open ? prisma.specialty.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    prisma.event.findMany({
      where: { status: "PUBLISHED", deletedAt: null, archivedAt: null, endDate: { gte: todayDateOnly() }, NOT: { id: e.id } },
      orderBy: { startDate: "asc" },
      take: 3,
      select: { title: true, slug: true, startDate: true, endDate: true, coverThumbUrl: true, city: { select: { name: true } } },
    }),
  ]);

  res.json({
    event: {
      title: e.title,
      slug: e.slug,
      subtitle: e.subtitle,
      format: e.format,
      attendanceMode: e.attendanceMode,
      startDate: formatDateOnly(e.startDate),
      endDate: formatDateOnly(e.endDate),
      city: e.city?.name ?? null,
      directions: e.directions.map((d) => d.name),
      nmoPoints: e.nmoPoints,
      expectedParticipants: e.expectedParticipants,
      description: e.description,
      keyFacts: e.keyFacts,
      organizers: e.organizers,
      coverUrl: e.coverUrl,
      venue: {
        name: e.venueName,
        address: e.venueAddress,
        howToGet: e.venueHowToGet,
        parking: e.venueParking,
        accommodation: e.venueAccommodation,
        lat: e.venueLat,
        lng: e.venueLng,
      },
      tariffs: e.tariffs,
      halls: e.halls,
      program: e.programDays.map((d) => ({
        id: d.id,
        date: formatDateOnly(d.date),
        title: d.title,
        sessions: d.sessions.map((s) => ({ ...s, speakers: s.speakers.map((sp) => ({ role: sp.role, ...speakerBrief(sp.speaker) })) })),
      })),
      speakers: e.speakers.map((s) => ({ role: s.role, ...speakerBrief(s.speaker), bio: s.speaker.bio })),
      partners: e.partners.map((p) => ({ level: p.level, ...p.partner })),
      documents: e.documents
        .filter((d) => d.eventSection === "MAIN")
        .map(({ eventSection: _s, publicId, ...d }) => ({ ...d, url: `/files/${publicId}` })),
      isPast,
      results: isPast
        ? {
            text: e.resultsText,
            facts: e.resultsFacts,
            links: e.resultsLinks,
            images: e.images,
            materials: e.documents
              .filter((d) => d.eventSection === "RESULTS")
              .map(({ eventSection: _s, publicId, ...d }) => ({ ...d, url: `/files/${publicId}` })),
          }
        : null,
      registration: {
        ...availability,
        showCount: e.showRegistrationCount,
        deadline: e.registrationDeadline,
        formats: e.registrationFormats,
        fields: resolveFields(e),
        specialties,
      },
    },
    others: others.map((o) => ({ ...o, startDate: formatDateOnly(o.startDate), endDate: formatDateOnly(o.endDate), city: o.city?.name ?? null })),
  });
});

function escape(v: string) {
  return v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

publicEventsRouter.post("/:slug/registrations", registrationLimiter, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { slug: String(req.params.slug), status: "PUBLISHED", deletedAt: null },
    select: { id: true, title: true, startDate: true, endDate: true, venueName: true, venueAddress: true, confirmationText: true, city: { select: { name: true } } },
  });
  if (!event) throw new HttpError(404, "Мероприятие не найдено");
  if (typeof req.body?.website === "string" && req.body.website) {
    res.status(201).json({ ok: true });
    return;
  }
  const { website: _w, ...body } = req.body ?? {};
  const r = await createRegistration(event.id, body, { source: "SITE", enforceAvailability: true });

  const settings = await getSiteSettings();
  const dates = event.startDate.getTime() === event.endDate.getTime()
    ? formatDateOnly(event.startDate).split("-").reverse().join(".")
    : `${formatDateOnly(event.startDate).split("-").reverse().join(".")} – ${formatDateOnly(event.endDate).split("-").reverse().join(".")}`;
  const place = [event.city?.name, event.venueName, event.venueAddress].filter(Boolean).join(", ");
  const contacts = [
    ...settings.contacts.phones.map((p) => formatPhone(p.number)),
    ...settings.contacts.emails.map((e) => e.email),
    settings.contacts.headerPhone,
  ].filter(Boolean) as string[];
  const participant = [`Здравствуйте, ${r.firstName}!`, "", `Вы зарегистрированы на мероприятие «${event.title}».`, `Даты: ${dates}`];
  if (place) participant.push(`Место: ${place}`);
  participant.push(`Формат участия: ${formatLabels[r.format]}`);
  if (event.confirmationText) participant.push("", event.confirmationText);
  if (contacts.length) participant.push("", `Контакты организатора: ${[...new Set(contacts)].join(", ")}`);

  const tasks: Promise<unknown>[] = [
    sendMail(r.email, `Регистрация на «${event.title}»`, participant.join("\n"), participant.map((l) => `<p>${escape(l)}</p>`).join("")),
  ];
  if (settings.notifications.onRegistration) {
    const manager = [
      `Новая заявка на «${event.title}»`,
      `${[r.lastName, r.firstName, r.middleName].filter(Boolean).join(" ")}, ${r.specialtyName}, ${r.city}`,
      `${r.email}, ${formatPhone(r.phone)}`,
      `Формат: ${formatLabels[r.format]}`,
    ];
    for (const to of settings.notifications.emails) {
      tasks.push(sendMail(to, `Новая регистрация: ${event.title}`, manager.join("\n"), manager.map((l) => `<p>${escape(l)}</p>`).join("")));
    }
  }
  await Promise.all(tasks.map((t) => t.catch((e) => console.error("Не удалось отправить письмо:", e))));

  res.status(201).json({ ok: true });
});
