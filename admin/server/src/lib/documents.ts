import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "../middleware/error.js";

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

export const svedenSections = [
  { key: "common", title: "Основные сведения" },
  { key: "struct", title: "Структура и органы управления образовательной организацией" },
  { key: "document", title: "Документы" },
  { key: "education", title: "Образование" },
  { key: "eduStandarts", title: "Образовательные стандарты и требования" },
  { key: "managers", title: "Руководство" },
  { key: "employees", title: "Педагогический состав" },
  { key: "objects", title: "Материально-техническое обеспечение и оснащённость образовательного процесса. Доступная среда" },
  { key: "paid_edu", title: "Платные образовательные услуги" },
  { key: "budget", title: "Финансово-хозяйственная деятельность" },
  { key: "vacant", title: "Вакантные места для приёма (перевода) обучающихся" },
  { key: "grants", title: "Стипендии и меры поддержки обучающихся" },
  { key: "inter", title: "Международное сотрудничество" },
  { key: "catering", title: "Организация питания в образовательной организации" },
] as const;

export type SvedenSection = (typeof svedenSections)[number]["key"];
export const svedenKeys = svedenSections.map((s) => s.key) as [SvedenSection, ...SvedenSection[]];

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const PDF = [0x25, 0x50, 0x44, 0x46];

const types: Record<string, { mime: string; signature: number[] }> = {
  pdf: { mime: "application/pdf", signature: PDF },
  doc: { mime: "application/msword", signature: OLE },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: ZIP },
  xls: { mime: "application/vnd.ms-excel", signature: OLE },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: ZIP },
};

function startsWith(buf: Buffer, sig: number[]) {
  return buf.length >= sig.length && sig.every((b, i) => buf[i] === b);
}

export function detectDocument(originalName: string, buffer: Buffer) {
  const extension = path.extname(originalName).slice(1).toLowerCase();
  const type = types[extension];
  if (!type) throw new HttpError(400, "Можно загрузить только PDF, DOC, DOCX, XLS или XLSX");
  if (!startsWith(buffer, type.signature)) {
    throw new HttpError(400, `Файл не похож на ${extension.toUpperCase()}. Проверьте, что он не повреждён и расширение указано верно`);
  }
  return { extension, mimeType: type.mime };
}

export function documentsDir() {
  return path.join(config.UPLOADS_DIR, "documents");
}

export async function storeDocument(buffer: Buffer, extension: string) {
  const now = new Date();
  const rel = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"), `${randomBytes(16).toString("base64url")}.${extension}`);
  await mkdir(path.dirname(path.join(documentsDir(), rel)), { recursive: true });
  await writeFile(path.join(documentsDir(), rel), buffer);
  return rel.split(path.sep).join("/");
}

export async function removeStoredDocument(fileKey: string) {
  const full = path.resolve(documentsDir(), fileKey);
  if (!full.startsWith(path.resolve(documentsDir()) + path.sep)) return;
  await rm(full, { force: true });
}

export function storedPath(fileKey: string) {
  return path.resolve(documentsDir(), fileKey);
}

export function newPublicId() {
  return randomBytes(9).toString("base64url");
}

export function titleFromFileName(name: string) {
  return path.basename(name, path.extname(name)).replace(/[_]+/g, " ").trim().slice(0, 200) || "Документ";
}

export function decodeFileName(name: string) {
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
}
