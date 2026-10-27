import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import {
  MIN_PASSWORD_LENGTH,
  createSession,
  destroySession,
  generateToken,
  hashPassword,
  hashToken,
  passwordSchemaMessage,
  sessionCookieOptions,
  toPublicUser,
  verifyPassword,
} from "../lib/auth.js";
import { sendPasswordLink } from "../lib/passwordLinks.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const authRouter = Router();

const dummyHash = hashPassword(generateToken());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Слишком много попыток. Повторите через 15 минут" },
});

const email = z.string().trim().toLowerCase().email("Введите корректный e-mail");
const newPassword = z.string().min(MIN_PASSWORD_LENGTH, passwordSchemaMessage).max(128);

function minutesLeft(until: Date) {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
}

authRouter.post("/login", limiter, async (req, res) => {
  const body = z
    .object({ email, password: z.string().min(1, "Введите пароль").max(128) })
    .parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(
      429,
      `Вход временно заблокирован из-за неудачных попыток. Повторите через ${minutesLeft(user.lockedUntil)} мин.`,
    );
  }

  const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash));

  if (!user || !ok) {
    if (user) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= config.maxFailedLogins;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + config.lockoutMs) : null,
        },
      });
    }
    throw new HttpError(401, "Неверный e-mail или пароль");
  }

  if (!user.isActive) throw new HttpError(403, "Учётная запись отключена. Обратитесь к администратору");

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const token = await createSession(user.id, { ip: req.ip, userAgent: req.get("user-agent") });
  res.cookie(config.sessionCookie, token, sessionCookieOptions());
  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[config.sessionCookie];
  if (typeof token === "string" && token) await destroySession(token);
  const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(config.sessionCookie, opts);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

authRouter.post("/forgot-password", limiter, async (req, res) => {
  const body = z.object({ email }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });

  if (user?.isActive) await sendPasswordLink(user, "reset");

  res.json({ ok: true });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const body = z
    .object({ currentPassword: z.string().min(1, "Введите текущий пароль").max(128), newPassword })
    .parse(req.body);

  const user = req.user!;
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Текущий пароль указан неверно", { currentPassword: "Текущий пароль указан неверно" });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } }),
    prisma.session.deleteMany({ where: { userId: user.id, NOT: { id: req.sessionId } } }),
  ]);

  res.json({ ok: true });
});

authRouter.post("/reset-password", limiter, async (req, res) => {
  const body = z.object({ token: z.string().min(1), password: newPassword }).parse(req.body);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(body.token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    throw new HttpError(400, "Ссылка недействительна или устарела. Запросите восстановление ещё раз");
  }

  const passwordHash = await hashPassword(body.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  res.json({ ok: true });
});
