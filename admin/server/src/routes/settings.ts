import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";

export const settingsRouter = Router();

settingsRouter.use(requireRole("ADMIN"));

const KEY = "site";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const phone = z
  .string()
  .trim()
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 && /^[\d\s()+\-–доб.,]+$/i.test(v);
  }, "Введите телефон, например +7 (343) 000-00-00");

const url = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      return new URL(withScheme).toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Введите ссылку, например vk.com/medexpo" });
      return null;
    }
  });

export const settingsSchema = z.object({
  contacts: z
    .object({
      headerPhone: phone.nullish().transform((v) => v || null),
      phones: z
        .array(z.object({ label: opt(80), number: phone }))
        .max(6, "Не больше шести телефонов")
        .default([]),
      emails: z
        .array(z.object({ label: opt(80), email: z.string().trim().toLowerCase().email("Введите корректный e-mail") }))
        .max(6, "Не больше шести адресов")
        .default([]),
      address: opt(300),
      workHours: opt(200),
      requisites: opt(3000),
      mapLat: z.number().min(-90).max(90).nullish().transform((v) => v ?? null),
      mapLng: z.number().min(-180).max(180).nullish().transform((v) => v ?? null),
      socials: z.object({ vk: url, telegram: url, youtube: url }).default({ vk: null, telegram: null, youtube: null }),
    })
    .default({ headerPhone: null, phones: [], emails: [], address: null, workHours: null, requisites: null, mapLat: null, mapLng: null, socials: { vk: null, telegram: null, youtube: null } }),
  numbers: z
    .array(z.object({ value: z.string().trim().min(1, "Введите цифру").max(20), label: z.string().trim().min(1, "Введите подпись").max(80) }))
    .max(6, "Не больше шести цифр")
    .default([]),
  notifications: z
    .object({
      onRegistration: z.boolean().default(true),
      emails: z.array(z.string().trim().toLowerCase().email("Введите корректный e-mail")).max(10, "Не больше 10 адресов").default([]),
    })
    .default({ onRegistration: true, emails: [] })
    .refine((n) => !n.onRegistration || n.emails.length > 0, { path: ["emails"], message: "Укажите хотя бы один адрес или выключите уведомления" }),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : settingsSchema.parse({ notifications: { onRegistration: false, emails: [] } });
}

settingsRouter.get("/", async (_req, res) => {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  res.json({ settings: await getSiteSettings(), updatedAt: row?.updatedAt ?? null });
});

settingsRouter.put("/", async (req, res) => {
  const value = settingsSchema.parse(req.body);
  const row = await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value, updatedById: req.user!.id },
    update: { value, updatedById: req.user!.id },
  });
  res.json({ settings: value, updatedAt: row.updatedAt });
});
