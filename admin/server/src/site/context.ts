import type { Request } from "express";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { blockSchemas, emptyBlocks, findPageDef, pageDefs } from "../lib/pages.js";
import { getSiteSettings, type SiteSettings } from "../routes/settings.js";

export type A11y = {
  on: boolean;
  fs: 1 | 2 | 3;
  scheme: "bw" | "wb" | "blue";
  ls: 0 | 1 | 2;
  images: boolean;
};

export type PageData = {
  key: string;
  title: string;
  path: string | null;
  body: string | null;
  blocks: any;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type SiteCtx = {
  settings: SiteSettings;
  pages: Map<string, PageData>;
  path: string;
  origin: string;
  a11y: A11y;
  cookiesAccepted: boolean;
  nonce: string;
  page(key: string): PageData;
  href(key: string): string;
};

export function readA11y(req: Request): A11y {
  const c = req.cookies ?? {};
  const fs = Number(c.a11y_fs);
  const ls = Number(c.a11y_ls);
  return {
    on: c.a11y === "1",
    fs: fs === 2 || fs === 3 ? fs : 1,
    scheme: c.a11y_sch === "wb" || c.a11y_sch === "blue" ? c.a11y_sch : "bw",
    ls: ls === 1 || ls === 2 ? ls : 0,
    images: c.a11y_img !== "0",
  };
}

export async function loadPages() {
  const rows = await prisma.page.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const map = new Map<string, PageData>();
  for (const def of pageDefs) {
    const row = byKey.get(def.key);
    const parsed = blockSchemas[def.kind].safeParse(row?.blocks ?? undefined);
    map.set(def.key, {
      key: def.key,
      title: row?.title ?? def.title,
      path: def.pathEditable ? (row?.path ?? def.defaultPath) : def.defaultPath,
      body: row?.body ?? null,
      blocks: parsed.success ? parsed.data : emptyBlocks(def.kind),
      seoTitle: row?.seoTitle ?? null,
      seoDescription: row?.seoDescription ?? null,
    });
  }
  return map;
}

export async function loadCtx(req: Request, nonce: string): Promise<SiteCtx> {
  const [settings, pages] = await Promise.all([getSiteSettings(), loadPages()]);
  return {
    settings,
    pages,
    path: req.path,
    origin: config.SITE_URL.replace(/\/$/, ""),
    a11y: readA11y(req),
    cookiesAccepted: req.cookies?.cookies_ok === "1",
    nonce,
    page(key) {
      const p = pages.get(key);
      if (!p) throw new Error(`Нет страницы ${key}`);
      return p;
    },
    href(key) {
      return pages.get(key)?.path ?? findPageDef(key)?.defaultPath ?? "/";
    },
  };
}
