import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const contactRequestsRouter = Router();

contactRequestsRouter.use(requireRole("ADMIN", "REGISTRATION_MANAGER"));

const PAGE_SIZE = 30;

contactRequestsRouter.get("/", async (req, res) => {
  const q = z
    .object({
      status: z.enum(["NEW", "PROCESSED"]).optional(),
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);
  const where: Prisma.ContactRequestWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { organization: { contains: q.q, mode: "insensitive" } },
            { email: { contains: q.q, mode: "insensitive" } },
            { phone: { contains: q.q.replace(/\D/g, "") || q.q } },
          ],
        }
      : {}),
  };
  const [total, items, newCount] = await Promise.all([
    prisma.contactRequest.count({ where }),
    prisma.contactRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      omit: { ip: true },
    }),
    prisma.contactRequest.count({ where: { status: "NEW" } }),
  ]);
  res.json({ total, page: q.page, pageSize: PAGE_SIZE, newCount, items });
});

contactRequestsRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const current = await prisma.contactRequest.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Обращение не найдено");
  const body = z
    .object({
      status: z.enum(["NEW", "PROCESSED"]).optional(),
      managerComment: z.string().trim().max(2000).nullish().transform((v) => (v === undefined ? undefined : v || null)),
    })
    .parse(req.body);
  const item = await prisma.contactRequest.update({
    where: { id },
    data: {
      ...body,
      ...(body.status && body.status !== current.status
        ? body.status === "PROCESSED"
          ? { processedAt: new Date(), processedById: req.user!.id }
          : { processedAt: null, processedById: null }
        : {}),
    },
    omit: { ip: true },
  });
  res.json({ item });
});

contactRequestsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = String(req.params.id);
  const { count } = await prisma.contactRequest.deleteMany({ where: { id } });
  if (!count) throw new HttpError(404, "Обращение не найдено");
  res.status(204).end();
});
