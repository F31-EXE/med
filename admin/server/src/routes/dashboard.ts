import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { formatDateOnly, todayDateOnly } from "../lib/dates.js";
import { computeAvailability, takenWhere } from "../lib/registrations.js";
import { pageDefs } from "../lib/pages.js";

export const dashboardRouter = Router();

const DAY = 24 * 60 * 60 * 1000;

async function registrationsBlock() {
  const since = new Date(Date.now() - DAY);
  const [newTotal, last24h, byEvent] = await Promise.all([
    prisma.registration.count({ where: { status: "NEW", event: { deletedAt: null } } }),
    prisma.registration.count({ where: { createdAt: { gte: since }, event: { deletedAt: null } } }),
    prisma.registration.groupBy({
      by: ["eventId"],
      where: { status: "NEW", event: { deletedAt: null } },
      _count: { _all: true },
      orderBy: { _count: { eventId: "desc" } },
      take: 5,
    }),
  ]);
  const events = await prisma.event.findMany({
    where: { id: { in: byEvent.map((b) => b.eventId) } },
    select: { id: true, title: true },
  });
  return {
    newTotal,
    last24h,
    byEvent: byEvent.map((b) => ({
      eventId: b.eventId,
      title: events.find((e) => e.id === b.eventId)?.title ?? "",
      count: b._count._all,
    })),
  };
}

async function upcomingEvents() {
  const today = todayDateOnly();
  const rows = await prisma.event.findMany({
    where: { deletedAt: null, archivedAt: null, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    take: 6,
    include: {
      city: { select: { name: true } },
      _count: { select: { programDays: true, speakers: true } },
    },
  });
  return Promise.all(
    rows.map(async (e) => {
      const taken = await prisma.registration.count({ where: takenWhere(e.id) });
      const availability = computeAvailability(e, taken);
      const warnings: string[] = [];
      if (e.status === "DRAFT") warnings.push("не опубликовано");
      if (!e.coverUrl) warnings.push("нет обложки");
      if (!e.description) warnings.push("нет описания");
      if (!e._count.programDays) warnings.push("нет программы");
      if (!e._count.speakers) warnings.push("нет спикеров");
      if (availability.reason === "full") warnings.push("места закончились");
      return {
        id: e.id,
        title: e.title,
        status: e.status,
        startDate: formatDateOnly(e.startDate),
        endDate: formatDateOnly(e.endDate),
        city: e.city?.name ?? null,
        daysLeft: Math.round((e.startDate.getTime() - today.getTime()) / DAY),
        availability,
        warnings,
      };
    }),
  );
}

async function contentBlock() {
  const now = new Date();
  const [scheduled, drafts, pages] = await Promise.all([
    prisma.news.findMany({
      where: { deletedAt: null, status: "PUBLISHED", publishAt: { gt: now } },
      orderBy: { publishAt: "asc" },
      take: 5,
      select: { id: true, title: true, publishAt: true },
    }),
    prisma.news.count({ where: { deletedAt: null, status: "DRAFT" } }),
    prisma.page.findMany({ select: { key: true, body: true, seoTitle: true, seoDescription: true } }),
  ]);
  const byKey = new Map(pages.map((p) => [p.key, p]));
  const emptyPages = pageDefs
    .filter((d) => d.key !== "not-found")
    .filter((d) => {
      const p = byKey.get(d.key);
      return !p || !(p.body || p.seoTitle || p.seoDescription);
    })
    .map((d) => ({ key: d.key, title: d.title }));
  const noSeo = pageDefs.filter((d) => d.key !== "not-found").filter((d) => {
    const p = byKey.get(d.key);
    return !p?.seoTitle || !p?.seoDescription;
  }).length;
  return { scheduledNews: scheduled, draftNews: drafts, emptyPages, pagesWithoutSeo: noSeo };
}

dashboardRouter.get("/", async (req, res) => {
  const role = req.user!.role;
  const seesContent = role === "ADMIN" || role === "EDITOR";
  const seesRegistrations = role === "ADMIN" || role === "REGISTRATION_MANAGER";
  const [events, registrations, content] = await Promise.all([
    upcomingEvents(),
    seesRegistrations ? registrationsBlock() : null,
    seesContent ? contentBlock() : null,
  ]);
  res.json({
    events: seesContent ? events : events.map(({ warnings: _w, ...e }) => ({ ...e, warnings: [] })),
    registrations,
    content,
  });
});
