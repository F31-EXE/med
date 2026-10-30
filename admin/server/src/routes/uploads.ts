import path from "node:path";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { saveFile } from "../lib/storage.js";

export const uploadsRouter = Router();

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const SVG = "image/svg+xml";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const logo = req.query.preset === "logo";
    if (allowed.has(file.mimetype) || (logo && file.mimetype === SVG)) cb(null, true);
    else cb(new HttpError(400, logo ? "Загрузите логотип в формате SVG, PNG, JPG или WebP" : "Загрузите изображение в формате JPG, PNG или WebP"));
  },
});

const presets = {
  speaker: { full: { width: 800, height: 800, fit: "inside" }, thumb: { width: 240, height: 240, fit: "cover" } },
  cover: { full: { width: 1920, height: 1080, fit: "inside" }, thumb: { width: 640, height: 360, fit: "cover" } },
  gallery: { full: { width: 1920, height: 1920, fit: "inside" }, thumb: { width: 480, height: 360, fit: "cover" } },
  logo: { full: { width: 800, height: 400, fit: "inside" }, thumb: { width: 320, height: 160, fit: "inside" } },
} as const;

uploadsRouter.post("/image", requireRole("ADMIN", "EDITOR"), (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new HttpError(400, err.code === "LIMIT_FILE_SIZE" ? "Файл больше 10 МБ" : "Не удалось загрузить файл"));
    }
    if (err) return next(err);
    next();
  });
}, async (req, res) => {
  if (!req.file) throw new HttpError(400, "Выберите файл");
  const presetName = String(req.query.preset);
  const preset = presets[Object.hasOwn(presets, presetName) ? (presetName as keyof typeof presets) : "speaker"];

  const now = new Date();
  const dir = path.join("images", String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const name = randomBytes(12).toString("base64url");

  let full: Buffer;
  let thumb: Buffer;
  try {
    const isSvg = req.file.mimetype === SVG;
    const source = sharp(req.file.buffer, { failOn: "error", ...(isSvg ? { density: 300 } : {}) }).rotate();
    [full, thumb] = await Promise.all([
      source.clone().resize({ ...preset.full, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      source
        .clone()
        .resize({ ...preset.thumb, ...(preset.thumb.fit === "cover" ? { position: "attention" } : { withoutEnlargement: true }) })
        .webp({ quality: 80 })
        .toBuffer(),
    ]);
  } catch {
    throw new HttpError(400, "Файл повреждён или не является изображением");
  }

  const base = `${dir.split(path.sep).join("/")}/${name}`;
  const [url, thumbUrl] = await Promise.all([saveFile(`${base}.webp`, full, "image/webp"), saveFile(`${base}-thumb.webp`, thumb, "image/webp")]);
  res.status(201).json({ url, thumbUrl });
});
