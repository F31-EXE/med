import { prisma } from "../lib/prisma.js";
import { formatDateOnly, todayDateOnly } from "../lib/dates.js";
import { computeAvailability } from "../lib/registrations.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { EventCardData } from "./ui.js";

export const publishedEvent = { status: "PUBLISHED", deletedAt: null } satisfies Prisma.EventWhereInput;

export function upcomingWhere(): Prisma.EventWhereInput {
  return { ...publishedEvent, archivedAt: null, endDate: { gte: todayDateOnly() } };
}

export function archiveWhere(): Prisma.EventWhereInput {
  return { ...publishedEvent, OR: [{ archivedAt: { not: null } }, { endDate: { lt: todayDateOnly() } }] };
}

export function publishedNewsWhere(): Prisma.NewsWhereInput {
  return { deletedAt: null, status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] };
}

export const eventCardSelect = {
  id: true,
  title: true,
  slug: true,
  format: true,
  startDate: true,
  endDate: true,
  dateUnknown: true,
  nmoPoints: true,
  venueName: true,
  coverThumbUrl: true,
  status: true,
  deletedAt: true,
  archivedAt: true,
  registrationEnabled: true,
  registrationDeadline: true,
  maxParticipants: true,
  city: { select: { name: true } },
} satisfies Prisma.EventSelect;

type CardRow = Prisma.EventGetPayload<{ select: typeof eventCardSelect }>;

export async function toCards(rows: CardRow[]): Promise<EventCardData[]> {
  const counts = rows.length
    ? await prisma.registration.groupBy({ by: ["eventId"], where: { eventId: { in: rows.map((r) => r.id) }, status: { not: "REJECTED" } }, _count: true })
    : [];
  const taken = new Map(counts.map((c) => [c.eventId, c._count]));
  const today = todayDateOnly();
  return rows.map((e) => ({
    title: e.title,
    slug: e.slug,
    format: e.format,
    startDate: formatDateOnly(e.startDate),
    endDate: formatDateOnly(e.endDate),
    dateUnknown: e.dateUnknown,
    city: e.city?.name ?? null,
    venueName: e.venueName,
    nmoPoints: e.nmoPoints,
    coverThumbUrl: e.coverThumbUrl,
    open: computeAvailability(e, taken.get(e.id) ?? 0).open,
    isPast: !!e.archivedAt || e.endDate < today,
  }));
}

export const newsCardSelect = { title: true, slug: true, excerpt: true, coverThumbUrl: true, publishAt: true } satisfies Prisma.NewsSelect;
