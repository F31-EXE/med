import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { svedenSections } from "../lib/documents.js";
import { loadPages } from "./context.js";
import { publishedEvent, publishedNewsWhere } from "./queries.js";

function origin() {
  return config.SITE_URL.replace(/\/$/, "");
}

export function robotsTxt() {
  return ["User-agent: *", "Disallow: /admin", "Disallow: /api/", "Disallow: /a11y/", "Disallow: /search", "", `Sitemap: ${origin()}/sitemap.xml`, ""].join("\n");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sitemapXml() {
  const [pages, events, news] = await Promise.all([
    loadPages(),
    prisma.event.findMany({ where: publishedEvent, select: { slug: true, updatedAt: true } }),
    prisma.news.findMany({ where: publishedNewsWhere(), select: { slug: true, updatedAt: true } }),
  ]);
  const urls: { loc: string; lastmod?: Date; priority?: string }[] = [
    { loc: "/", priority: "1.0" },
    { loc: "/events", priority: "0.9" },
    { loc: "/events?tab=archive", priority: "0.5" },
    { loc: "/news", priority: "0.7" },
  ];
  for (const key of ["about", "contacts", "privacy", "consent"]) {
    const p = pages.get(key)?.path;
    if (p) urls.push({ loc: p, priority: "0.6" });
  }
  urls.push({ loc: "/sveden", priority: "0.5" });
  for (const s of svedenSections) urls.push({ loc: `/sveden/${s.key}`, priority: "0.3" });
  for (const e of events) urls.push({ loc: `/events/${e.slug}`, lastmod: e.updatedAt, priority: "0.8" });
  for (const n of news) urls.push({ loc: `/news/${n.slug}`, lastmod: n.updatedAt, priority: "0.6" });
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${esc(origin() + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
