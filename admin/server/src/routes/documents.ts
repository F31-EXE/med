import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { formatDateOnly } from "../lib/dates.js";
import { slugify } from "../lib/slug.js";
import {
  MAX_DOCUMENT_SIZE,
  decodeFileName,
  detectDocument,
  newPublicId,
  removeStoredDocument,
  storeDocument,
  storedPath,
  svedenKeys,
  svedenSections,
  titleFromFileName,
} from "../lib/documents.js";
import { isRemote } from "../lib/storage.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const documentsRouter = Router();
export const publicFilesRouter = Router();

documentsRouter.use(requireRole("ADMIN", "EDITOR"));

const PAGE_SIZE = 30;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1, fields: 20 } });

function receiveFile(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new HttpError(400, err.code === "LIMIT_FILE_SIZE" ? "Файл больше 20 МБ" : "Не удалось загрузить файл"));
    }
    if (err) return next(err);
    next();
  });
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const metaSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(200),
  description: text(1000),
  eventId: z.string().nullish().transform((v) => v || null),
  svedenSection: z.enum(svedenKeys, { error: "Неизвестный подраздел" }).nullish().transform((v) => v || null),
  eventSection: z.enum(["MAIN", "RESULTS"]).optional(),
});

const include = { event: { select: { id: true, title: true, startDate: true } } } satisfies Prisma.DocumentInclude;

function serialize(d: Prisma.DocumentGetPayload<{ include: typeof include }>) {
  const { fileKey: _f, ...rest } = d;
  return {
    ...rest,
    url: `/files/${d.publicId}`,
    event: d.event ? { ...d.event, startDate: formatDateOnly(d.event.startDate) } : null,
    sectionTitle: svedenSections.find((s) => s.key === d.svedenSection)?.title ?? null,
  };
}

async function findDocument(id: string) {
  const doc = await prisma.document.findUnique({ where: { id }, include });
  if (!doc) throw new HttpError(404, "Документ не найден");
  return doc;
}

async function checkEvent(eventId: string | null) {
  if (eventId && !(await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } }))) {
    throw new HttpError(400, "Мероприятие не найдено", { eventId: "Мероприятие не найдено" });
  }
}

async function nextOrder(where: Prisma.DocumentWhereInput, field: "eventSortOrder" | "sectionSortOrder") {
  const max = await prisma.document.aggregate({ where, _max: { [field]: true } });
  return ((max._max as Record<string, number | null>)[field] ?? -1) + 1;
}

documentsRouter.get("/sections", async (_req, res) => {
  const counts = await prisma.document.groupBy({ by: ["svedenSection"], where: { svedenSection: { not: null } }, _count: { _all: true } });
  res.json({
    sections: svedenSections.map((s) => ({ ...s, count: counts.find((c) => c.svedenSection === s.key)?._count._all ?? 0 })),
  });
});

documentsRouter.get("/", async (req, res) => {
  const q = z
    .object({
      q: z.string().trim().max(100).optional(),
      eventId: z.string().optional(),
      section: z.enum(svedenKeys).optional(),
      eventSection: z.enum(["MAIN", "RESULTS"]).optional(),
      unplaced: z.enum(["true"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);

  const where: Prisma.DocumentWhereInput = {
    AND: [
      q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: "insensitive" } },
              { originalName: { contains: q.q, mode: "insensitive" } },
              { description: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {},
      q.eventId ? { eventId: q.eventId } : {},
      q.eventId && q.eventSection ? { eventSection: q.eventSection } : {},
      q.section ? { svedenSection: q.section } : {},
      q.unplaced ? { eventId: null, svedenSection: null } : {},
    ],
  };
  const orderBy: Prisma.DocumentOrderByWithRelationInput[] = q.eventId
    ? [{ eventSortOrder: "asc" }, { createdAt: "asc" }]
    : q.section
      ? [{ sectionSortOrder: "asc" }, { createdAt: "asc" }]
      : [{ fileUpdatedAt: "desc" }];

  const scoped = !!(q.eventId || q.section);
  const [total, rows] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({ where, include, orderBy, ...(scoped ? {} : { skip: (q.page - 1) * PAGE_SIZE, take: PAGE_SIZE }) }),
  ]);
  res.json({ total, page: q.page, pageSize: scoped ? total : PAGE_SIZE, items: rows.map(serialize) });
});

documentsRouter.get("/:id", async (req, res) => {
  res.json({ document: serialize(await findDocument(String(req.params.id))) });
});

documentsRouter.post("/", receiveFile, async (req, res) => {
  if (!req.file) throw new HttpError(400, "Выберите файл", { file: "Выберите файл" });
  const originalName = decodeFileName(req.file.originalname);
  const { extension, mimeType } = detectDocument(originalName, req.file.buffer);
  const parsed = metaSchema.parse({ ...req.body, title: req.body.title || titleFromFileName(originalName) });
  const meta = { ...parsed, eventSection: parsed.eventSection ?? "MAIN" };
  await checkEvent(meta.eventId);

  const fileKey = await storeDocument(req.file.buffer, extension);
  try {
    const doc = await prisma.document.create({
      data: {
        ...meta,
        publicId: newPublicId(),
        fileKey,
        originalName,
        extension,
        mimeType,
        size: req.file.size,
        eventSortOrder: meta.eventId ? await nextOrder({ eventId: meta.eventId, eventSection: meta.eventSection }, "eventSortOrder") : 0,
        sectionSortOrder: meta.svedenSection ? await nextOrder({ svedenSection: meta.svedenSection }, "sectionSortOrder") : 0,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
      include,
    });
    res.status(201).json({ document: serialize(doc) });
  } catch (e) {
    await removeStoredDocument(fileKey);
    throw e;
  }
});

documentsRouter.put("/:id", async (req, res) => {
  const current = await findDocument(String(req.params.id));
  const parsed = metaSchema.parse(req.body);
  const meta = { ...parsed, eventSection: parsed.eventSection ?? current.eventSection };
  await checkEvent(meta.eventId);
  const doc = await prisma.document.update({
    where: { id: current.id },
    data: {
      ...meta,
      eventSortOrder:
        meta.eventId && (meta.eventId !== current.eventId || meta.eventSection !== current.eventSection)
          ? await nextOrder({ eventId: meta.eventId, eventSection: meta.eventSection }, "eventSortOrder")
          : current.eventSortOrder,
      sectionSortOrder:
        meta.svedenSection && meta.svedenSection !== current.svedenSection
          ? await nextOrder({ svedenSection: meta.svedenSection }, "sectionSortOrder")
          : current.sectionSortOrder,
      updatedById: req.user!.id,
    },
    include,
  });
  res.json({ document: serialize(doc) });
});

documentsRouter.post("/:id/file", receiveFile, async (req, res) => {
  const current = await findDocument(String(req.params.id));
  if (!req.file) throw new HttpError(400, "Выберите файл", { file: "Выберите файл" });
  const originalName = decodeFileName(req.file.originalname);
  const { extension, mimeType } = detectDocument(originalName, req.file.buffer);
  const fileKey = await storeDocument(req.file.buffer, extension);
  try {
    const doc = await prisma.document.update({
      where: { id: current.id },
      data: { fileKey, originalName, extension, mimeType, size: req.file.size, fileUpdatedAt: new Date(), updatedById: req.user!.id },
      include,
    });
    await removeStoredDocument(current.fileKey);
    res.json({ document: serialize(doc) });
  } catch (e) {
    await removeStoredDocument(fileKey);
    throw e;
  }
});

documentsRouter.put("/order/:scope", async (req, res) => {
  const scope = z.enum(["event", "section"]).parse(req.params.scope);
  const body = z
    .object({ key: z.string().min(1), ids: z.array(z.string()).max(500), eventSection: z.enum(["MAIN", "RESULTS"]).default("MAIN") })
    .parse(req.body);
  const where: Prisma.DocumentWhereInput =
    scope === "event" ? { eventId: body.key, eventSection: body.eventSection } : { svedenSection: z.enum(svedenKeys).parse(body.key) };
  const existing = await prisma.document.findMany({ where, select: { id: true } });
  const known = new Set(existing.map((d) => d.id));
  if (body.ids.length !== known.size || body.ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "Список документов изменился. Обновите страницу");
  }
  const field = scope === "event" ? "eventSortOrder" : "sectionSortOrder";
  await prisma.$transaction(body.ids.map((id, i) => prisma.document.update({ where: { id }, data: { [field]: i } })));
  res.status(204).end();
});

documentsRouter.delete("/:id", async (req, res) => {
  const current = await findDocument(String(req.params.id));
  await prisma.document.delete({ where: { id: current.id } });
  await removeStoredDocument(current.fileKey);
  res.status(204).end();
});

publicFilesRouter.get("/:publicId{/:name}", async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { publicId: String(req.params.publicId) } });
  if (!doc) throw new HttpError(404, "Файл не найден");
  const asciiName = `${slugify(doc.title) || "document"}.${doc.extension}`;
  const ruName = `${doc.title.replace(/[\\/:*?"<>|]/g, " ").trim()}.${doc.extension}`;
  if (isRemote(doc.fileKey)) return res.redirect(302, doc.fileKey);
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader(
    "Content-Disposition",
    `${doc.extension === "pdf" ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(ruName)}`,
  );
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(storedPath(doc.fileKey), { lastModified: true, etag: true, headers: { "Content-Type": doc.mimeType } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Файл не найден" });
  });
});
