import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { CookieOptions } from "express";
import { config } from "../config.js";
import { prisma } from "./prisma.js";
import type { Role, User } from "../generated/prisma/client.js";

export type PublicUser = Pick<User, "id" | "email" | "name" | "role">;

export const passwordSchemaMessage = "Пароль должен быть не короче 8 символов";
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "strict",
    path: "/",
    maxAge: config.sessionTtlMs,
  };
}

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = generateToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + config.sessionTtlMs),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 500),
    },
  });
  return token;
}

export async function findSessionUser(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastUsedAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + config.sessionTtlMs) },
    });
  }
  return { sessionId: session.id, user: session.user };
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export const roleLabels: Record<Role, string> = {
  ADMIN: "Администратор",
  EDITOR: "Редактор",
  REGISTRATION_MANAGER: "Менеджер регистрации",
};
