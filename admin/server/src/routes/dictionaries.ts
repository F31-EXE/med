import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const dictionariesRouter = Router();

type DictItem = { id: string; name: string; isActive: boolean; createdAt: Date };

interface DictDelegate {
  findUnique(args: { where: { id: string } }): Promise<DictItem | null>;
  findFirst(args: { where: { name: { equals: string; mode: "insensitive" }; NOT?: { id: string } } }): Promise<DictItem | null>;
  create(args: { data: { name: string } }): Promise<DictItem>;
  update(args: { where: { id: string }; data: { name?: string; isActive?: boolean } }): Promise<DictItem>;
  delete(args: { where: { id: string } }): Promise<DictItem>;
}

const dictionaries = {
  directions: {
    delegate: prisma.direction as unknown as DictDelegate,
    list: (where: { isActive?: boolean }) =>
      prisma.direction
        .findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { events: true } } } })
        .then((rows) => rows.map(({ _count, ...r }) => ({ ...r, usage: _count.events }))),
    usage: (id: string) => prisma.event.count({ where: { directions: { some: { id } } } }),
  },
  cities: {
    delegate: prisma.city as unknown as DictDelegate,
    list: (where: { isActive?: boolean }) =>
      prisma.city
        .findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { events: true } } } })
        .then((rows) => rows.map(({ _count, ...r }) => ({ ...r, usage: _count.events }))),
    usage: (id: string) => prisma.event.count({ where: { cityId: id } }),
  },
  specialties: {
    delegate: prisma.specialty as unknown as DictDelegate,
    list: (where: { isActive?: boolean }) =>
      prisma.specialty.findMany({ where, orderBy: { name: "asc" } }).then((rows) => rows.map((r) => ({ ...r, usage: 0 }))),
    usage: async (_id: string) => 0,
  },
};

type DictType = keyof typeof dictionaries;

const typeSchema = z.enum(Object.keys(dictionaries) as [DictType, ...DictType[]], { error: "Неизвестный справочник" });
const name = z.string().trim().min(2, "Введите название").max(100, "Слишком длинное название");

function getDict(type: string) {
  const parsed = typeSchema.safeParse(type);
  if (!parsed.success) throw new HttpError(404, "Справочник не найден");
  return dictionaries[parsed.data];
}

async function ensureUniqueName(dict: (typeof dictionaries)[DictType], value: string, exceptId?: string) {
  const existing = await dict.delegate.findFirst({
    where: { name: { equals: value, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
  if (existing) throw new HttpError(409, "Такое значение уже есть", { name: "Такое значение уже есть" });
}

async function findItem(dict: (typeof dictionaries)[DictType], id: string) {
  const item = await dict.delegate.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, "Запись не найдена");
  return item;
}

dictionariesRouter.get("/:type", async (req, res) => {
  const dict = getDict(String(req.params.type));
  const { active } = z.object({ active: z.enum(["true"]).optional() }).parse(req.query);
  res.json({ items: await dict.list(active ? { isActive: true } : {}) });
});

dictionariesRouter.post("/:type", requireRole("ADMIN"), async (req, res) => {
  const dict = getDict(String(req.params.type));
  const body = z.object({ name }).parse(req.body);
  await ensureUniqueName(dict, body.name);
  res.status(201).json({ item: await dict.delegate.create({ data: body }) });
});

dictionariesRouter.patch("/:type/:id", requireRole("ADMIN"), async (req, res) => {
  const dict = getDict(String(req.params.type));
  const body = z.object({ name: name.optional(), isActive: z.boolean().optional() }).parse(req.body);
  await findItem(dict, String(req.params.id));
  if (body.name) await ensureUniqueName(dict, body.name, String(req.params.id));
  res.json({ item: await dict.delegate.update({ where: { id: String(req.params.id) }, data: body }) });
});

dictionariesRouter.delete("/:type/:id", requireRole("ADMIN"), async (req, res) => {
  const dict = getDict(String(req.params.type));
  await findItem(dict, String(req.params.id));
  const usage = await dict.usage(String(req.params.id));
  if (usage > 0) {
    throw new HttpError(409, `Значение используется в мероприятиях (${usage}). Отключите его вместо удаления`);
  }
  await dict.delegate.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});
