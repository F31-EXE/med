import "dotenv/config";
import "../src/lib/dbEnv.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BASE = (process.env.OLD_BASE || "https://2527244.21.oml.ru").replace(/\/+$/, "");
const OUT = path.join(import.meta.dirname, "legacy", "files", "old-events");
const data = JSON.parse(await readFile(path.join(import.meta.dirname, "legacy", "data.json"), "utf8")) as {
  events: { slug: string; oldPrefix?: string; startDate: string }[];
};
const prefixes = data.events.filter((e) => e.oldPrefix).map((e) => ({ prefix: e.oldPrefix!, slug: e.slug })).sort((a, b) => b.prefix.length - a.prefix.length);

if (process.argv.includes("--apply")) {
  await applyManifest();
  process.exit(0);
}

async function applyManifest() {
  const { randomBytes } = await import("node:crypto");
  const { prisma } = await import("../src/lib/prisma.js");
  const { saveFile } = await import("../src/lib/storage.js");
  type Item = { file: string; alt: string; title: string; href: string; width: number; height: number };
  const manifest = JSON.parse(await readFile(path.join(OUT, "manifest.json"), "utf8")) as { slug: string; images: Item[] }[];

  const presets = {
    cover: { full: { width: 1920, height: 1080, fit: "inside" as const }, thumb: { width: 640, height: 360, fit: "cover" as const } },
    gallery: { full: { width: 1920, height: 1920, fit: "inside" as const }, thumb: { width: 480, height: 360, fit: "cover" as const } },
    logo: { full: { width: 800, height: 400, fit: "inside" as const }, thumb: { width: 320, height: 160, fit: "inside" as const } },
  };
  async function store(file: string, preset: keyof typeof presets) {
    const p = presets[preset];
    const src = sharp(await readFile(file)).rotate();
    const name = randomBytes(9).toString("base64url");
    const thumbOpts = p.thumb.fit === "cover" ? { ...p.thumb, position: "attention" as const } : { ...p.thumb, withoutEnlargement: true };
    const [full, thumb] = await Promise.all([
      src.clone().resize({ ...p.full, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer(),
      src.clone().resize(thumbOpts).webp({ quality: 82 }).toBuffer(),
    ]);
    const [url, thumbUrl] = await Promise.all([
      saveFile(`images/legacy/${name}.webp`, full, "image/webp"),
      saveFile(`images/legacy/${name}-thumb.webp`, thumb, "image/webp"),
    ]);
    return { url, thumbUrl };
  }
  const host = (u: string) => {
    try {
      return /^https?:/i.test(u) ? new URL(u).hostname.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  };
  const isLogo = (i: Item) => (i.width <= 700 && i.height <= 260) || (!!host(i.href) && !host(i.href).endsWith("oml.ru") && !host(i.href).endsWith("med-expo.org") && i.height <= 400);

  const report: string[] = [];
  for (const entry of manifest) {
    const event = await prisma.event.findUnique({
      where: { slug: entry.slug },
      select: { id: true, coverUrl: true, _count: { select: { partners: true, images: true } } },
    });
    if (!event) {
      report.push(`${entry.slug}: мероприятия нет в базе`);
      continue;
    }
    const dir = path.join(OUT, entry.slug);
    const logos = entry.images.filter(isLogo);
    const photos = entry.images.filter((i) => !isLogo(i));
    const done: string[] = [];

    if (logos.length && event._count.partners === 0) {
      for (const [n, l] of logos.entries()) {
        const url = host(l.href) ? l.href : null;
        const name = (l.alt || l.title || host(l.href) || `Организатор ${n + 1}`).slice(0, 200);
        let partner = await prisma.partner.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, logoUrl: true } });
        if (!partner && host(l.href)) partner = await prisma.partner.findFirst({ where: { url: { contains: host(l.href), mode: "insensitive" } }, select: { id: true, logoUrl: true } });
        if (!partner) {
          const logo = await store(path.join(dir, l.file), "logo");
          partner = await prisma.partner.create({ data: { name, url, logoUrl: logo.url, logoThumbUrl: logo.thumbUrl }, select: { id: true, logoUrl: true } });
        }
        await prisma.eventPartner.upsert({
          where: { eventId_partnerId: { eventId: event.id, partnerId: partner.id } },
          create: { eventId: event.id, partnerId: partner.id, level: "ORGANIZER", sortOrder: n },
          update: {},
        });
      }
      done.push(`организаторов ${logos.length}`);
    } else if (logos.length) done.push(`логотипы пропущены — партнёры уже есть (${event._count.partners})`);

    const rest = [...photos];
    if (!event.coverUrl && rest.length) {
      const cover = await store(path.join(dir, rest.shift()!.file), "cover");
      await prisma.event.update({ where: { id: event.id }, data: { coverUrl: cover.url, coverThumbUrl: cover.thumbUrl } });
      done.push("обложка");
    }
    if (rest.length && event._count.images === 0) {
      for (const [n, ph] of rest.entries()) {
        const img = await store(path.join(dir, ph.file), "gallery");
        await prisma.eventImage.create({ data: { eventId: event.id, url: img.url, thumbUrl: img.thumbUrl, caption: ph.alt || null, sortOrder: n } });
      }
      done.push(`фото в галерею ${rest.length}`);
    } else if (rest.length) done.push(`фото пропущены — галерея уже есть (${event._count.images})`);

    report.push(`${entry.slug}: ${done.join(", ") || "нечего добавлять"}`);
  }
  console.log("ЗАПИСАНО В БАЗУ\n" + report.join("\n"));
  console.log("\nНазвания организаторов взяты из подписей картинок или адресов сайтов — поправьте их в админке «Партнёры и клиенты».");
  await prisma.$disconnect();
}

async function get(url: string) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (med-expo migration)" } });
  return res;
}

async function html(url: string) {
  const res = await get(url);
  return res.ok ? await res.text() : "";
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const attr = (tag: string, name: string) => decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "");

const listPages = ["/meropriyatiya", "/meropriyatiya/archive"];
for (let y = 2018; y <= new Date().getFullYear() + 1; y++) listPages.push(`/meropriyatiya/archive?year=${y}`);
for (let p = 1; p <= 6; p++) listPages.push(`/meropriyatiya/archive/p/${p}`);

const posts = new Map<string, string>();
for (const p of listPages) {
  const page = await html(BASE + p);
  for (const m of page.matchAll(/href="(\/meropriyatiya\/post\/[^"#?]+)"/g)) {
    const href = decode(m[1]!);
    const tail = href.split("/post/")[1]!;
    const hit = prefixes.find((x) => tail.startsWith(x.prefix));
    if (hit && !posts.has(href)) posts.set(href, hit.slug);
  }
}
console.log(`Страниц мероприятий на старом сайте: ${posts.size} (адрес: ${BASE})`);

const chrome = new Set<string>();
for (const m of (await html(BASE + "/")).matchAll(/<img\b[^>]*>/gi)) chrome.add(attr(m[0], "src"));

type Img = { file: string; src: string; alt: string; title: string; href: string; width: number; height: number };
const manifest: { slug: string; url: string; title: string; images: Img[] }[] = [];

for (const [href, slug] of posts) {
  const page = await html(BASE + href);
  const title = decode(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "");
  if (!page || /Страница не найдена/.test(title)) {
    console.log(`\n${slug}: страница не открылась`);
    continue;
  }
  const start = Math.max(0, page.search(/<h1/i));
  const body = page.slice(start).replace(/<footer[\s\S]*$/i, "");
  const images: Img[] = [];
  const seen = new Set<string>();
  const dir = path.join(OUT, slug);
  await mkdir(dir, { recursive: true });
  for (const m of body.matchAll(/(<a\b[^>]*>\s*)?(<img\b[^>]*>)/gi)) {
    const tag = m[2]!;
    const src = attr(tag, "src") || attr(tag, "data-src");
    if (!src || chrome.has(src) || seen.has(src) || /^data:|\.svg($|\?)/i.test(src) || /\/(t|g)\/|counter|metrika|captcha/i.test(src)) continue;
    seen.add(src);
    const full = src.match(/\/d\/[^/?#]+$/) && src.startsWith("/thumb/") ? src.replace(/^\/thumb\/.*?(\/d\/[^/?#]+)$/, "$1") : src;
    let buf: Buffer | null = null;
    for (const u of [full, src]) {
      const res = await get(u.startsWith("http") ? u : BASE + u).catch(() => null);
      if (res?.ok && /^image\//.test(res.headers.get("content-type") ?? "")) {
        buf = Buffer.from(await res.arrayBuffer());
        break;
      }
    }
    if (!buf) continue;
    const meta = await sharp(buf).metadata().catch(() => null);
    if (!meta?.width || !meta.height) continue;
    const file = `${String(images.length + 1).padStart(2, "0")}-${decodeURIComponent(full.split("/").pop()!).replace(/[^\w.-]+/g, "_")}`;
    await writeFile(path.join(dir, file), buf);
    images.push({ file, src: full, alt: attr(tag, "alt"), title: attr(tag, "title"), href: m[1] ? attr(m[1], "href") : "", width: meta.width, height: meta.height });
  }
  manifest.push({ slug, url: BASE + href, title, images });
  console.log(`\n${slug}: картинок ${images.length}`);
  for (const i of images) console.log(`  ${i.file}  ${i.width}x${i.height}${i.alt ? `  alt="${i.alt.slice(0, 50)}"` : ""}${i.href ? `  → ${i.href.slice(0, 60)}` : ""}`);
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nСохранено в ${OUT} (manifest.json и папки по мероприятиям). В базу ничего не записано.\nЗаписать: npm run db:legacy-event-media -w server -- --apply`);
