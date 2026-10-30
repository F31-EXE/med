import "dotenv/config";
import "../src/lib/dbEnv.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type EventFormat, type PartnerLevel } from "../src/generated/prisma/client.js";
import { saveFile } from "../src/lib/storage.js";
import { storeDocument } from "../src/lib/documents.js";
import { sanitizeRichText } from "../src/lib/richText.js";
import { findPageDef } from "../src/lib/pages.js";

const reset = process.argv.includes("--reset");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const SRC = path.join(import.meta.dirname, "legacy");

type LegacyEvent = {
  slug: string;
  title: string;
  subtitle: string | null;
  startDate: string;
  endDate: string;
  dateUnknown?: boolean;
  format: EventFormat;
  attendanceMode: "OFFLINE" | "ONLINE" | "HYBRID";
  city: string | null;
  directions: string[];
  archived: boolean;
  description?: string | null;
  expectedParticipants?: number;
  keyFacts?: { value: string; label: string }[];
  organizers?: string;
  venueName?: string;
  venueAddress?: string;
  venueHowToGet?: string;
  cover?: string;
  documents?: { file: string; title: string; section: "MAIN" | "RESULTS" }[];
  resultsHtml?: string;
  resultsImages?: string[];
  committee?: [string, string, string | null, string | null, string][];
  partners?: [string, string | null, string, PartnerLevel][];
};

type Data = {
  directions: string[];
  cities: string[];
  specialties: string[];
  events: LegacyEvent[];
  news: { slug: string; title: string; excerpt: string | null; bodyHtml: string; publishAt: string; eventSlug: string | null; cover: string | null }[];
  homePartners: { name: string; url: string | null; logo: string }[];
  sveden_docs: { section: string; file: string; title: string }[];
  pages: { key: string; title?: string; path?: string; body?: string; blocks?: object }[];
  settings: object;
  redirects: Record<string, string>;
  skipped: Record<string, string[]>;
};

const data: Data = JSON.parse(await readFile(path.join(SRC, "data.json"), "utf8"));

const presets = {
  cover: { full: { width: 1920, height: 1080, fit: "inside" as const }, thumb: { width: 640, height: 360, fit: "cover" as const } },
  gallery: { full: { width: 1920, height: 1920, fit: "inside" as const }, thumb: { width: 480, height: 360, fit: "cover" as const } },
  logo: { full: { width: 800, height: 400, fit: "inside" as const }, thumb: { width: 320, height: 160, fit: "inside" as const } },
};

const imageCache = new Map<string, { url: string; thumbUrl: string }>();

async function image(file: string, preset: keyof typeof presets) {
  const key = `${file}:${preset}`;
  if (imageCache.has(key)) return imageCache.get(key)!;
  const p = presets[preset];
  const name = randomBytes(9).toString("base64url");
  const src = sharp(await readFile(path.join(SRC, "files", file))).rotate();
  const thumbOpts = p.thumb.fit === "cover" ? { ...p.thumb, position: "attention" as const } : { ...p.thumb, withoutEnlargement: true };
  const [full, thumb] = await Promise.all([
    src.clone().resize({ ...p.full, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer(),
    src.clone().resize(thumbOpts).webp({ quality: 82 }).toBuffer(),
  ]);
  const [url, thumbUrl] = await Promise.all([
    saveFile(`images/legacy/${name}.webp`, full, "image/webp"),
    saveFile(`images/legacy/${name}-thumb.webp`, thumb, "image/webp"),
  ]);
  const result = { url, thumbUrl };
  imageCache.set(key, result);
  return result;
}

const docIds = new Map<string, string>();

async function document(file: string, title: string, extra: { eventId?: string; eventSection?: "MAIN" | "RESULTS"; eventSortOrder?: number; svedenSection?: string; sectionSortOrder?: number }) {
  const buf = await readFile(path.join(SRC, "files", file));
  const rel = await storeDocument(buf, "pdf");
  const doc = await prisma.document.create({
    data: {
      publicId: randomBytes(9).toString("base64url"),
      title,
      fileKey: rel,
      originalName: path.basename(file),
      extension: "pdf",
      mimeType: "application/pdf",
      size: buf.length,
      eventId: extra.eventId,
      eventSection: extra.eventSection ?? "MAIN",
      eventSortOrder: extra.eventSortOrder ?? 0,
      svedenSection: extra.svedenSection,
      sectionSortOrder: extra.sectionSortOrder ?? 0,
    },
  });
  docIds.set(file, doc.publicId);
  return doc;
}

function htmlToText(html: string) {
  return sanitizeRichText(html)
    .replace(/<\/(p|h\d|li|blockquote)>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

const dateOnly = (v: string) => new Date(`${v}T00:00:00.000Z`);

if ((await prisma.event.count()) > 0 && process.argv.includes("--if-empty")) {
  console.log("В базе уже есть мероприятия, импорт пропущен");
  await prisma.$disconnect();
  process.exit(0);
}
if ((await prisma.event.count()) > 0 && !reset) {
  console.error("В базе уже есть мероприятия. Импорт заменит весь контент — запустите с флагом --reset");
  process.exit(1);
}

console.log("Очищаю контент (пользователи и обращения остаются)…");
await prisma.$transaction([
  prisma.registration.deleteMany(),
  prisma.newsImage.deleteMany(),
  prisma.news.deleteMany(),
  prisma.document.deleteMany(),
  prisma.eventPartner.deleteMany(),
  prisma.eventImage.deleteMany(),
  prisma.sessionSpeaker.deleteMany(),
  prisma.programSession.deleteMany(),
  prisma.programDay.deleteMany(),
  prisma.hall.deleteMany(),
  prisma.eventSpeaker.deleteMany(),
  prisma.eventTariff.deleteMany(),
  prisma.event.deleteMany(),
  prisma.speaker.deleteMany(),
  prisma.partner.deleteMany(),
  prisma.page.deleteMany(),
  prisma.siteSetting.deleteMany(),
  prisma.direction.deleteMany(),
  prisma.city.deleteMany(),
  prisma.specialty.deleteMany(),
  prisma.redirect.deleteMany(),
]);

const directions = new Map<string, string>();
for (const name of data.directions) directions.set(name, (await prisma.direction.create({ data: { name } })).id);
const cities = new Map<string, string>();
for (const name of data.cities) cities.set(name, (await prisma.city.create({ data: { name } })).id);
await prisma.specialty.createMany({ data: data.specialties.map((name) => ({ name })) });

const partners = new Map<string, string>();
async function partner(name: string, url: string | null, logo: string, home: boolean, order: number) {
  if (partners.has(name)) {
    if (home) await prisma.partner.update({ where: { id: partners.get(name)! }, data: { showOnHome: true, homeSortOrder: order } });
    return partners.get(name)!;
  }
  const img = await image(logo, "logo");
  const p = await prisma.partner.create({ data: { name, url, logoUrl: img.url, logoThumbUrl: img.thumbUrl, showOnHome: home, homeSortOrder: order } });
  partners.set(name, p.id);
  return p.id;
}
for (const [i, p] of data.homePartners.entries()) await partner(p.name, p.url, p.logo, true, i);

const events = new Map<string, string>();
for (const e of data.events) {
  const cover = e.cover ? await image(e.cover, "cover") : null;
  const created = await prisma.event.create({
    data: {
      title: e.title,
      slug: e.slug,
      subtitle: e.subtitle,
      format: e.format,
      attendanceMode: e.attendanceMode,
      status: "PUBLISHED",
      publishedAt: new Date(),
      startDate: dateOnly(e.startDate),
      endDate: dateOnly(e.endDate),
      dateUnknown: e.dateUnknown ?? false,
      cityId: e.city ? (cities.get(e.city) ?? null) : null,
      directions: { connect: e.directions.map((d) => ({ id: directions.get(d)! })) },
      expectedParticipants: e.expectedParticipants ?? null,
      description: e.description ?? null,
      keyFacts: e.keyFacts ?? [],
      organizers: e.organizers ?? null,
      venueName: e.venueName ?? null,
      venueAddress: e.venueAddress ?? null,
      venueHowToGet: e.venueHowToGet ?? null,
      coverUrl: cover?.url ?? null,
      coverThumbUrl: cover?.thumbUrl ?? null,
      registrationEnabled: !e.archived,
      registrationFormats: e.attendanceMode === "ONLINE" ? ["ONLINE"] : ["OFFLINE"],
      archivedAt: e.archived ? new Date() : null,
      resultsText: e.resultsHtml ? htmlToText(e.resultsHtml) : null,
    },
  });
  events.set(e.slug, created.id);

  for (const [i, d] of (e.documents ?? []).entries()) await document(d.file, d.title, { eventId: created.id, eventSection: d.section, eventSortOrder: i });
  for (const [i, file] of (e.resultsImages ?? []).entries()) {
    const img = await image(file, "gallery");
    await prisma.eventImage.create({ data: { eventId: created.id, url: img.url, thumbUrl: img.thumbUrl, sortOrder: i } });
  }
  for (const [i, [lastName, firstName, middleName, degree, position]] of (e.committee ?? []).entries()) {
    const sp = await prisma.speaker.create({ data: { lastName, firstName, middleName, degree, position } });
    await prisma.eventSpeaker.create({ data: { eventId: created.id, speakerId: sp.id, role: "COMMITTEE", sortOrder: i } });
  }
  const order: Record<string, number> = {};
  for (const [name, url, logo, level] of e.partners ?? []) {
    const partnerId = await partner(name, url, `img/${logo}`, false, 0);
    order[level] = (order[level] ?? -1) + 1;
    await prisma.eventPartner.create({ data: { eventId: created.id, partnerId, level, sortOrder: order[level] } });
  }
}

for (const n of data.news) {
  const cover = n.cover ? await image(n.cover, "cover") : null;
  await prisma.news.create({
    data: {
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt,
      body: sanitizeRichText(n.bodyHtml),
      coverUrl: cover?.url ?? null,
      coverThumbUrl: cover?.thumbUrl ?? null,
      eventId: n.eventSlug ? (events.get(n.eventSlug) ?? null) : null,
      status: "PUBLISHED",
      publishAt: new Date(n.publishAt),
    },
  });
}

for (const [i, d] of data.sveden_docs.entries()) await document(d.file, d.title, { svedenSection: d.section, sectionSortOrder: i });

for (const p of data.pages) {
  const def = findPageDef(p.key);
  if (!def) throw new Error(`Неизвестная страница ${p.key}`);
  await prisma.page.create({
    data: {
      key: p.key,
      title: p.title ?? def.title,
      path: def.pathEditable ? (p.path ?? def.defaultPath) : null,
      body: p.body ?? null,
      blocks: (p.blocks ?? {}) as object,
    },
  });
}

await prisma.siteSetting.create({ data: { key: "site", value: { ...(data.settings as object), notifications: { onRegistration: false, emails: [] } } } });

const redirects = Object.entries(data.redirects).map(([fromPath, to]) => {
  if (to.startsWith("@doc:")) {
    const id = docIds.get(to.slice(5));
    if (!id) throw new Error(`Нет документа для редиректа ${fromPath}`);
    return { fromPath, toPath: `/files/${id}` };
  }
  return { fromPath, toPath: to };
});
await prisma.redirect.createMany({ data: redirects });

console.log(`Импортировано: мероприятий ${data.events.length}, новостей ${data.news.length}, партнёров ${partners.size}, документов ${docIds.size}, редиректов ${redirects.length}`);
for (const [reason, items] of Object.entries(data.skipped)) {
  console.log(`\nНе импортировано — ${reason}:`);
  for (const i of items) console.log(`  · ${i}`);
}
console.log("\nУведомления о заявках выключены: включите их в «Настройки → Уведомления» и укажите адреса.");
await prisma.$disconnect();
