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
console.log(`\nСохранено в ${OUT} (manifest.json и папки по мероприятиям). В базу ничего не записано.`);
