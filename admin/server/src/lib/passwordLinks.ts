import { config } from "../config.js";
import { prisma } from "./prisma.js";
import { generateToken, hashToken } from "./auth.js";
import { sendMail } from "./mailer.js";
import type { User } from "../generated/prisma/client.js";

type LinkKind = "reset" | "invite";

const ttlMs: Record<LinkKind, number> = {
  reset: config.resetTokenTtlMs,
  invite: config.inviteTokenTtlMs,
};

export async function sendPasswordLink(user: User, kind: LinkKind) {
  const token = generateToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + ttlMs[kind]),
      },
    }),
  ]);

  const link = `${config.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const name = escapeHtml(user.name);

  if (kind === "invite") {
    await sendMail(
      user.email,
      "Доступ к админ-панели Media Expo Group",
      `Здравствуйте, ${user.name}!\n\nДля вас создана учётная запись в админ-панели сайта med-expo.org. Чтобы задать пароль и войти, перейдите по ссылке (действует 3 дня):\n${link}\n\nЛогин: ${user.email}`,
      `<p>Здравствуйте, ${name}!</p><p>Для вас создана учётная запись в админ-панели сайта med-expo.org. Чтобы задать пароль и войти, перейдите по ссылке (действует 3&nbsp;дня):</p><p><a href="${link}">${link}</a></p><p>Логин: ${escapeHtml(user.email)}</p>`,
    );
    return;
  }

  await sendMail(
    user.email,
    "Восстановление пароля — админ-панель Media Expo Group",
    `Здравствуйте, ${user.name}!\n\nЧтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n${link}\n\nЕсли вы не запрашивали восстановление, просто проигнорируйте это письмо.`,
    `<p>Здравствуйте, ${name}!</p><p>Чтобы задать новый пароль, перейдите по ссылке (действует 1&nbsp;час):</p><p><a href="${link}">${link}</a></p><p>Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>`,
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
