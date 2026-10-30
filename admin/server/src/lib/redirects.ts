import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma.js";

const TTL = 60 * 1000;
let cache: { at: number; map: Map<string, string> } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  const rows = await prisma.redirect.findMany({ select: { fromPath: true, toPath: true } });
  cache = { at: Date.now(), map: new Map(rows.map((r) => [r.fromPath, r.toPath])) };
  return cache.map;
}

export function resetRedirectCache() {
  cache = null;
}

function decode(v: string) {
  try {
    return decodeURI(v);
  } catch {
    return v;
  }
}

export async function legacyRedirects(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const map = await load();
  if (!map.size) return next();
  const url = decode(req.originalUrl);
  const path = decode(req.path);
  const key = map.has(url) ? url : map.has(path) ? path : map.has(path.replace(/\/+$/, "")) ? path.replace(/\/+$/, "") : null;
  if (!key) return next();
  prisma.redirect.update({ where: { fromPath: key }, data: { hits: { increment: 1 } } }).catch(() => {});
  res.redirect(301, map.get(key)!);
}
