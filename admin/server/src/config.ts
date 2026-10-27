import { z } from "zod";

z.config(z.locales.ru());

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:5173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Media Expo Group <noreply@med-expo.org>"),
  TIMEZONE: z.string().default("Asia/Yekaterinburg"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Некорректные переменные окружения:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  resetTokenTtlMs: 60 * 60 * 1000,
  inviteTokenTtlMs: 3 * 24 * 60 * 60 * 1000,
  trashTtlMs: 30 * 24 * 60 * 60 * 1000,
  maxFailedLogins: 5,
  lockoutMs: 15 * 60 * 1000,
  sessionCookie: "mexpo_sid",
};
