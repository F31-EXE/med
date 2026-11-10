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
  type Item = { file: string; alt: string; title: string; href: string; width: number; height: number; group?: string; row?: number; shownHeight?: number };
  const manifest = JSON.parse(await readFile(path.join(OUT, "manifest.json"), "utf8")) as {
    slug: string;
    images: Item[];
    text?: string;
    docs?: { file: string; title: string; original: string }[];
  }[];
  const { detectDocument, newPublicId, storeDocument } = await import("../src/lib/documents.js");

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
  const levelOf = (g = "") =>
    /титул|генерал/i.test(g) ? ("GENERAL" as const) : /информац|сми/i.test(g) ? ("INFO" as const) : /спонсор|участник|выстав|партн/i.test(g) ? ("OFFICIAL" as const) : ("ORGANIZER" as const);
  const groupTitle = (g = "") => {
    const t = g.replace(/[:.\s]+$/, "").trim();
    if (!t) return null;
    const lower = t === t.toUpperCase() ? t.toLowerCase() : t;
    return (lower[0]!.toUpperCase() + lower.slice(1)).slice(0, 100);
  };
  const external = (i: Item) => !!host(i.href) && !/(^|\.)(oml\.ru|med-expo\.org)$/.test(host(i.href));
  const isLogo = (i: Item) =>
    (i.row ?? 1) > 1 || !!i.group || external(i) || (!!i.shownHeight && i.shownHeight <= 260) || (i.width <= 700 && i.height <= 260);

  const legacy = JSON.parse(await readFile(path.join(import.meta.dirname, "legacy", "data.json"), "utf8")) as {
    homePartners: { name: string; logo: string }[];
    events: { partners?: [string, string | null, string, string][] }[];
  };
  const knownByFile = new Map<string, string>();
  for (const p of legacy.homePartners) knownByFile.set(path.basename(p.logo).toLowerCase(), p.name);
  for (const e of legacy.events) for (const [name, , logo] of e.partners ?? []) knownByFile.set(path.basename(logo).toLowerCase(), name);
  const report: string[] = [];
  for (const entry of manifest) {
    const event = await prisma.event.findUnique({
      where: { slug: entry.slug },
      select: { id: true, coverUrl: true, description: true, _count: { select: { partners: true, images: true, documents: true } } },
    });
    if (!event) {
      report.push(`${entry.slug}: мероприятия нет в базе`);
      continue;
    }
    const dir = path.join(OUT, entry.slug);
    const logos = entry.images.filter(isLogo);
    const photos = entry.images.filter((i) => !isLogo(i));
    const done: string[] = [];

    const replace = process.argv.includes("--replace-partners");
    if (logos.length && replace && event._count.partners) await prisma.eventPartner.deleteMany({ where: { eventId: event.id } });
    if (logos.length && (event._count.partners === 0 || replace)) {
      for (const [n, l] of logos.entries()) {
        const url = host(l.href) ? l.href : null;
        const known = knownByFile.get(l.file.replace(/^\d+-/, "").toLowerCase());
        const name = (l.alt || l.title || known || host(l.href) || `Партнёр ${n + 1}`).slice(0, 200);
        let partner = await prisma.partner.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, logoUrl: true } });
        if (!partner && host(l.href)) partner = await prisma.partner.findFirst({ where: { url: { contains: host(l.href), mode: "insensitive" } }, select: { id: true, logoUrl: true } });
        if (!partner) {
          const logo = await store(path.join(dir, l.file), "logo");
          partner = await prisma.partner.create({ data: { name, url, logoUrl: logo.url, logoThumbUrl: logo.thumbUrl }, select: { id: true, logoUrl: true } });
        }
        await prisma.eventPartner.upsert({
          where: { eventId_partnerId: { eventId: event.id, partnerId: partner.id } },
          create: { eventId: event.id, partnerId: partner.id, level: levelOf(l.group), groupTitle: groupTitle(l.group), sortOrder: n },
          update: {},
        });
      }
      const groups = [...new Set(logos.map((l) => groupTitle(l.group) ?? "Организаторы"))];
      done.push(`логотипов ${logos.length} (${groups.join(" / ")})`);
    } else if (logos.length) done.push(`логотипы пропущены — партнёры уже есть (${event._count.partners}); заменить: --replace-partners`);

    if (entry.text && !event.description?.trim()) {
      await prisma.event.update({ where: { id: event.id }, data: { description: entry.text.slice(0, 20000) } });
      done.push(`описание (${entry.text.length} симв.)`);
    } else if (entry.text) done.push("описание уже есть");

    const files = entry.docs ?? [];
    if (files.length && event._count.documents === 0) {
      let n = 0;
      for (const d of files) {
        const buf = await readFile(path.join(dir, d.file));
        let type: { extension: string; mimeType: string };
        try {
          type = detectDocument(d.original, buf);
        } catch {
          continue;
        }
        const fileKey = await storeDocument(buf, type.extension);
        await prisma.document.create({
          data: { publicId: newPublicId(), title: (groupTitle(d.title) ?? d.original).slice(0, 200), fileKey, originalName: d.original, extension: type.extension, mimeType: type.mimeType, size: buf.length, eventId: event.id, eventSection: "MAIN", eventSortOrder: n++ },
        });
      }
      done.push(`документов ${n}`);
    } else if (files.length) done.push(`документы уже есть (${event._count.documents})`);

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
  console.log("\nНазвания партнёров взяты из подписей картинок, уже известных логотипов или адресов сайтов — поправьте их в админке «Партнёры и клиенты».");
  await prisma.$disconnect();
}

async function get(url: string) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (med-expo migration)" } });
  return res;
}

async function html(url: string) {
  const res = await get(url).catch(() => null);
  return res?.ok ? await res.text() : "";
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const attr = (tag: string, name: string) => decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "");

const listPages = ["/meropriyatiya", "/meropriyatiya/archive"];
for (let y = 2018; y <= new Date().getFullYear() + 1; y++) listPages.push(`/meropriyatiya/archive?year=${y}`);
for (let p = 1; p <= 6; p++) listPages.push(`/meropriyatiya/archive/p/${p}`);

const fromDirAt = process.argv.indexOf("--from-dir");
const fromDir = fromDirAt > 0 ? process.argv[fromDirAt + 1] : undefined;
const posts = new Map<string, string>();
for (const p of fromDir ? [] : listPages) {
  const page = await html(BASE + p);
  for (const m of page.matchAll(/href="(\/meropriyatiya\/post\/[^"#?]+)"/g)) {
    const href = decode(m[1]!);
    const tail = href.split("/post/")[1]!;
    const hit = prefixes.find((x) => tail.startsWith(x.prefix));
    if (hit && !posts.has(href)) posts.set(href, hit.slug);
  }
}
const sources: { slug: string; url: string; page: string }[] = [];
if (fromDir) {
  const { readdir } = await import("node:fs/promises");
  const months = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
  const slugs = new Set(data.events.map((e) => e.slug));
  const unknown: string[] = [];
  for (const name of (await readdir(fromDir)).filter((f) => /\.(html?|txt)$/i.test(f)).sort()) {
    const page = await readFile(path.join(fromDir, name), "utf8");
    const stem = name.replace(/\.[^.]+$/, "");
    const tail = page.match(/\/meropriyatiya\/post\/([^"'\s<>?#]+)/)?.[1] ?? stem;
    let slug = slugs.has(stem) ? stem : prefixes.find((x) => tail.startsWith(x.prefix) || stem.startsWith(x.prefix))?.slug;
    if (!slug) {
      const plain = decode(page.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").slice(0, 1500).toLowerCase();
      const dm = plain.match(/(\d{1,2})(?:\s*[-–]\s*\d{1,2})?[\s.-]+([а-яё]+)\s+(\d{4})/);
      const mi = dm ? months.findIndex((m) => dm[2]!.startsWith(m)) : -1;
      if (dm && mi >= 0) {
        const iso = `${dm[3]}-${String(mi + 1).padStart(2, "0")}-${dm[1]!.padStart(2, "0")}`;
        const hits = data.events.filter((e) => e.startDate === iso);
        if (hits.length === 1) slug = hits[0]!.slug;
      }
    }
    if (slug) sources.push({ slug, url: path.join(fromDir, name), page });
    else unknown.push(name);
  }
  console.log(`Файлов с HTML: ${sources.length + unknown.length}, мероприятие определено у ${sources.length}`);
  if (unknown.length) console.log(`Не удалось определить мероприятие — переименуйте файл в адрес мероприятия (например, chaklinskie-chteniya-2019.html):\n  ${unknown.join("\n  ")}`);
} else {
  for (const [href, slug] of posts) sources.push({ slug, url: BASE + href, page: await html(BASE + href) });
  console.log(`Страниц мероприятий на старом сайте: ${posts.size} (адрес: ${BASE})`);
}

const chrome = new Set<string>();
for (const m of (await html(BASE + "/")).matchAll(/<img\b[^>]*>/gi)) chrome.add(attr(m[0], "src"));

type Img = { file: string; src: string; alt: string; title: string; href: string; width: number; height: number; group: string; row: number; shownHeight: number };
const manifest: { slug: string; url: string; title: string; images: Img[]; text: string; docs: { file: string; title: string; original: string }[] }[] = [];

for (const { slug, url, page } of sources) {
  const title = decode(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "");
  if (!page || /Страница не найдена/.test(title)) {
    console.log(`\n${slug}: страница не открылась`);
    continue;
  }
  const contentAt = page.indexOf("g-page-article__text");
  const start = contentAt > 0 ? page.lastIndexOf("<", contentAt) : Math.max(0, page.search(/<h1/i));
  const tail = page.slice(start);
  const stop = [tail.search(/mosaic-form/i), tail.indexOf("Есть вопросы?"), tail.search(/<footer/i)].filter((i) => i > 0);
  const body = stop.length ? tail.slice(0, Math.min(...stop)) : tail;
  const paragraphs: { text: string; heading: boolean }[] = [];
  const docs: { file: string; title: string; original: string }[] = [];
  const images: Img[] = [];
  const seen = new Set<string>();
  const dir = path.join(OUT, slug);
  await mkdir(dir, { recursive: true });
  const blockRe = /<\/?(?:p|div|td|tr|li|ul|ol|table|h[1-6]|figure|section|article|br)\b[^>]*>/gi;
  const segments = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").split(blockRe);
  const textOf = (seg: string) => decode(seg.replace(/<[^>]+>/g, " ")).replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  let group = "";
  for (const seg of segments) {
    for (const l of seg.matchAll(/<a\b[^>]*href="([^"]+\.(?:pdf|docx?|xlsx?))"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const link = decode(l[1]!);
      const original = decodeURIComponent(link.split("/").pop()!);
      if (docs.some((d) => d.original === original)) continue;
      const res = await get(/^https?:/i.test(link) ? link : BASE + (link.startsWith("/") ? link : `/${link}`)).catch(() => null);
      if (!res?.ok) continue;
      const file = `doc-${String(docs.length + 1).padStart(2, "0")}-${original.replace(/[^\w.-]+/g, "_")}`;
      await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
      docs.push({ file, title: textOf(l[2]!).replace(/[.:]+$/, "") || original, original });
    }
    const imgs = [...seg.matchAll(/(<a\b[^>]*>\s*)?(<img\b[^>]*>)/gi)];
    if (!imgs.length) {
      const t = textOf(seg);
      if (t) {
        group = t.length <= 80 && !/[.!?…]$/.test(t) && (/:$/.test(t) || t === t.toUpperCase() || t.length <= 40) ? t : "";
        paragraphs.push({ text: t, heading: false });
      }
      continue;
    }
    const last = paragraphs[paragraphs.length - 1];
    if (group && last && last.text === group) last.heading = true;
    for (const m of imgs) {
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
      const shown = Number(attr(tag, "height") || tag.match(/height:\s*(\d+)px/i)?.[1] || src.match(/\/\d+r(\d+)\//)?.[1] || 0);
      const file = `${String(images.length + 1).padStart(2, "0")}-${decodeURIComponent(full.split("/").pop()!).replace(/[^\w.-]+/g, "_")}`;
      await writeFile(path.join(dir, file), buf);
      images.push({
        file,
        src: full,
        alt: attr(tag, "alt"),
        title: attr(tag, "title"),
        href: m[1] ? attr(m[1], "href") : "",
        width: meta.width,
        height: meta.height,
        group,
        row: imgs.length,
        shownHeight: shown,
      });
    }
  }
  const docTitles = new Set(docs.map((d) => d.title.toLowerCase()));
  const text = paragraphs
    .filter((x) => !x.heading && x.text !== title && !docTitles.has(x.text.replace(/[.:]+$/, "").toLowerCase()))
    .map((x) => x.text)
    .join("\n\n");
  manifest.push({ slug, url, title, images, text, docs });
  console.log(`\n${slug}: картинок ${images.length}, текст ${text.length} симв., файлов ${docs.length}`);
  for (const d of docs) console.log(`  файл: ${d.title.slice(0, 70)} (${d.original})`);
  for (const i of images) console.log(`  ${i.file}  ${i.width}x${i.height}${i.alt ? `  alt="${i.alt.slice(0, 50)}"` : ""}${i.href ? `  → ${i.href.slice(0, 60)}` : ""}${i.row > 1 ? `  ряд ${i.row}` : ""}${i.group ? `  [${i.group.slice(0, 40)}]` : ""}`);
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nСохранено в ${OUT} (manifest.json и папки по мероприятиям). В базу ничего не записано.\nЗаписать: npm run db:legacy-event-media -w server -- --apply`);
