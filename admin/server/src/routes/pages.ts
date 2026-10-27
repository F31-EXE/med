import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { blockSchemas, emptyBlocks, findPageDef, pageDefs, reservedPrefixes, type PageDef } from "../lib/pages.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Page } from "../generated/prisma/client.js";

export const pagesRouter = Router();

pagesRouter.use(requireRole("ADMIN", "EDITOR"));

function merge(def: PageDef, row: Page | undefined) {
  const parsed = blockSchemas[def.kind].safeParse(row?.blocks ?? undefined);
  return {
    key: def.key,
    group: def.group,
    kind: def.kind,
    hint: def.hint ?? null,
    defaultTitle: def.title,
    pathEditable: def.pathEditable,
    defaultPath: def.defaultPath,
    title: row?.title ?? def.title,
    path: def.pathEditable ? (row?.path ?? def.defaultPath) : def.defaultPath,
    body: row?.body ?? null,
    blocks: parsed.success ? parsed.data : emptyBlocks(def.kind),
    seoTitle: row?.seoTitle ?? null,
    seoDescription: row?.seoDescription ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

pagesRouter.get("/", async (_req, res) => {
  const rows = await prisma.page.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  res.json({
    pages: pageDefs.map((d) => {
      const p = merge(d, byKey.get(d.key));
      return {
        key: p.key,
        group: p.group,
        title: p.title,
        path: p.path,
        hint: p.hint,
        updatedAt: p.updatedAt,
        filled: !!(p.body || p.seoTitle || p.seoDescription || (p.kind !== "text" && JSON.stringify(p.blocks) !== JSON.stringify(emptyBlocks(p.kind)))),
        hasSeo: !!(p.seoTitle && p.seoDescription),
      };
    }),
  });
});

pagesRouter.get("/:key", async (req, res) => {
  const def = findPageDef(String(req.params.key));
  if (!def) throw new HttpError(404, "Страница не найдена");
  const row = await prisma.page.findUnique({ where: { key: def.key } });
  res.json({ page: merge(def, row ?? undefined) });
});

const pathSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/, "Адрес вида /about или /info/history: латиница, цифры, дефис");

pagesRouter.put("/:key", async (req, res) => {
  const def = findPageDef(String(req.params.key));
  if (!def) throw new HttpError(404, "Страница не найдена");

  const body = z
    .object({
      title: z.string().trim().min(1, "Введите заголовок").max(200),
      path: pathSchema.nullish(),
      body: z
        .string()
        .max(100000, "Текст слишком длинный")
        .nullish()
        .transform((v) => (v?.trim() ? v : null)),
      blocks: blockSchemas[def.kind],
      seoTitle: z.string().trim().max(120).nullish().transform((v) => v || null),
      seoDescription: z.string().trim().max(300).nullish().transform((v) => v || null),
    })
    .parse(req.body);

  let path = def.defaultPath;
  if (def.pathEditable && body.path) {
    if (reservedPrefixes.some((p) => body.path === p || body.path!.startsWith(`${p}/`))) {
      throw new HttpError(400, "Этот адрес занят разделом сайта", { path: "Адрес занят разделом сайта (мероприятия, новости, сведения…)" });
    }
    const rows = await prisma.page.findMany({ where: { NOT: { key: def.key } } });
    const taken = pageDefs.some((d) => {
      if (d.key === def.key) return false;
      const row = rows.find((r) => r.key === d.key);
      const p = d.pathEditable ? (row?.path ?? d.defaultPath) : d.defaultPath;
      return p === body.path;
    });
    if (taken) throw new HttpError(409, "Такой адрес уже у другой страницы", { path: "Такой адрес уже у другой страницы" });
    path = body.path;
  }

  const data = {
    title: body.title,
    path: def.pathEditable ? path : null,
    body: body.body,
    blocks: body.blocks as object,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    updatedById: req.user!.id,
  };
  const row = await prisma.page.upsert({ where: { key: def.key }, create: { key: def.key, ...data }, update: data });
  res.json({ page: merge(def, row) });
});
