import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { generateToken, hashPassword } from "../lib/auth.js";
import { sendPasswordLink } from "../lib/passwordLinks.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { Prisma } from "../generated/prisma/client.js";

export const usersRouter = Router();

usersRouter.use(requireRole("ADMIN"));

const role = z.enum(["ADMIN", "EDITOR", "REGISTRATION_MANAGER"], { error: "Выберите роль" });
const name = z.string().trim().min(2, "Введите имя").max(100);

const select = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

async function findUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Пользователь не найден");
  return user;
}

usersRouter.get("/", async (req, res) => {
  const query = z
    .object({
      q: z.string().trim().max(100).optional(),
      role: role.optional(),
      status: z.enum(["active", "inactive"]).optional(),
    })
    .parse(req.query);

  const where: Prisma.UserWhereInput = {
    role: query.role,
    isActive: query.status ? query.status === "active" : undefined,
    OR: query.q
      ? [
          { name: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const users = await prisma.user.findMany({ where, select, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  res.json({ users });
});

usersRouter.post("/", async (req, res) => {
  const body = z
    .object({ email: z.string().trim().toLowerCase().email("Введите корректный e-mail"), name, role })
    .parse(req.body);

  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw new HttpError(409, "Пользователь с таким e-mail уже есть", { email: "Этот e-mail уже используется" });
  }

  const user = await prisma.user.create({
    data: { ...body, passwordHash: await hashPassword(generateToken()) },
  });
  await sendPasswordLink(user, "invite");

  res.status(201).json({ user: await prisma.user.findUnique({ where: { id: user.id }, select }) });
});

usersRouter.patch("/:id", async (req, res) => {
  const body = z
    .object({ name: name.optional(), role: role.optional(), isActive: z.boolean().optional() })
    .parse(req.body);
  const target = await findUser(req.params.id);
  const isSelf = target.id === req.user!.id;

  if (isSelf && body.role && body.role !== target.role) {
    throw new HttpError(400, "Нельзя изменить собственную роль");
  }
  if (isSelf && body.isActive === false) {
    throw new HttpError(400, "Нельзя отключить собственную учётную запись");
  }

  const losesAdmin =
    target.role === "ADMIN" &&
    target.isActive &&
    ((body.role !== undefined && body.role !== "ADMIN") || body.isActive === false);

  if (losesAdmin) {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, NOT: { id: target.id } },
    });
    if (otherAdmins === 0) throw new HttpError(400, "В системе должен остаться хотя бы один активный администратор");
  }

  const user = await prisma.user.update({ where: { id: target.id }, data: body, select });
  if (body.isActive === false) await prisma.session.deleteMany({ where: { userId: target.id } });

  res.json({ user });
});

usersRouter.post("/:id/send-link", async (req, res) => {
  const target = await findUser(req.params.id);
  if (!target.isActive) throw new HttpError(400, "Учётная запись отключена");
  await sendPasswordLink(target, target.lastLoginAt ? "reset" : "invite");
  res.json({ ok: true });
});
