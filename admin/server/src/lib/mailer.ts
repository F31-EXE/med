import nodemailer from "nodemailer";
import { config } from "../config.js";

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!transport) {
    console.log(`[mail] SMTP не настроен, письмо не отправлено.\nКому: ${to}\nТема: ${subject}\n${text}`);
    return;
  }
  await transport.sendMail({ from: config.MAIL_FROM, to, subject, text, html });
}
