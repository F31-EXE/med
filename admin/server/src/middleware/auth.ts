import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { findSessionUser } from "../lib/auth.js";
import type { Role, User } from "../generated/prisma/client.js";
import { HttpError } from "./error.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[config.sessionCookie];
  if (typeof token === "string" && token) {
    const found = await findSessionUser(token);
    if (found) {
      req.user = found.user;
      req.sessionId = found.sessionId;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, "Требуется вход в систему");
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "Требуется вход в систему");
    if (!roles.includes(req.user.role)) throw new HttpError(403, "Недостаточно прав");
    next();
  };
}

export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    throw new HttpError(403, "Запрос отклонён");
  }
  next();
}
