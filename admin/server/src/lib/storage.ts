import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { z } from "zod";

const uploadsDir = process.env.UPLOADS_DIR || "uploads";
export const blobEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;
export const BLOB_HOST = "https://*.public.blob.vercel-storage.com";

const blobUrl = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;

export function isRemote(urlOrKey: string) {
  return blobUrl.test(urlOrKey);
}

export async function saveFile(key: string, body: Buffer, contentType: string) {
  if (blobEnabled) {
    const blob = await put(key, body, { access: "public", contentType, addRandomSuffix: false, cacheControlMaxAge: 60 * 60 * 24 * 365 });
    return blob.url;
  }
  const full = path.join(uploadsDir, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return `/uploads/${key}`;
}

export async function removeFile(urlOrPath: string) {
  if (isRemote(urlOrPath)) {
    if (blobEnabled) await del(urlOrPath);
    return;
  }
  const root = path.resolve(uploadsDir);
  const full = path.resolve(root, urlOrPath.replace(/^\/uploads\//, ""));
  if (full.startsWith(root + path.sep)) await rm(full, { force: true });
}

export function localFile(url: string) {
  return path.resolve(uploadsDir, url.replace(/^\/uploads\//, ""));
}

export function imageUrlSchema(message = "Некорректная ссылка на изображение") {
  return z.string().regex(/^(\/uploads\/|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/)[\w/.-]+\.webp$/, message);
}
