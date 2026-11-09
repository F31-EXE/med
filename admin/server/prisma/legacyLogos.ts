import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { saveFile } from "../src/lib/storage.js";

const SRC = path.join(import.meta.dirname, "legacy");
export const LOGO_DIR = path.join(SRC, "files", "event-logos");

export async function loadEventLogos(): Promise<Record<string, string>> {
  return JSON.parse(await readFile(path.join(SRC, "event-logos.json"), "utf8"));
}

export function logoFile(file: string) {
  const full = path.join(LOGO_DIR, file);
  return existsSync(full) ? full : null;
}

async function onCanvas(logo: Buffer, width: number, height: number) {
  const meta = await sharp(logo).metadata();
  const w = meta.width ?? width;
  const h = meta.height ?? height;
  const scale = Math.min((width * 0.62) / w, (height * 0.62) / h, 3);
  const inner = await sharp(logo)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), fit: "inside", kernel: "lanczos3" })
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite([{ input: inner, gravity: "center" }])
    .webp({ quality: 86 })
    .toBuffer();
}

export async function logoCover(file: string) {
  const buf = await readFile(file);
  const name = randomBytes(9).toString("base64url");
  const [full, thumb] = await Promise.all([onCanvas(buf, 1600, 900), onCanvas(buf, 640, 360)]);
  const [url, thumbUrl] = await Promise.all([
    saveFile(`images/legacy/${name}.webp`, full, "image/webp"),
    saveFile(`images/legacy/${name}-thumb.webp`, thumb, "image/webp"),
  ]);
  return { url, thumbUrl };
}
