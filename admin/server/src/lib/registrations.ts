import { z } from "zod";
import { prisma } from "./prisma.js";
import { todayDateOnly } from "./dates.js";
import { HttpError } from "../middleware/error.js";
import type { Event, ParticipationFormat, Prisma, RegistrationSource } from "../generated/prisma/client.js";

export const participationFormats = ["OFFLINE", "ONLINE", "EXHIBITOR", "SPEAKER"] as const;

export const formatLabels: Record<ParticipationFormat, string> = {
  OFFLINE: "Очно",
  ONLINE: "Онлайн",
  EXHIBITOR: "Экспонент",
  SPEAKER: "Докладчик",
};

export const statusLabels = { NEW: "Новая", CONFIRMED: "Подтверждена", REJECTED: "Отклонена" } as const;
export const sourceLabels = { SITE: "Сайт", MANUAL: "Вручную" } as const;

export const registrationFieldsSchema = z.object({
  middleName: z.boolean().default(true),
  workplace: z.boolean().default(true),
  position: z.boolean().default(true),
  mailingConsent: z.boolean().default(true),
});

export type RegistrationFields = z.infer<typeof registrationFieldsSchema>;

export function resolveFields(event: Pick<Event, "registrationFields">): RegistrationFields {
  const parsed = registrationFieldsSchema.safeParse(event.registrationFields ?? {});
  return parsed.success ? parsed.data : registrationFieldsSchema.parse({});
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits[0] === "9") return `+7${digits}`;
  return null;
}

export function formatPhone(value: string) {
  const m = value.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}` : value;
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

export function registrationInputSchema(event: Pick<Event, "registrationFields" | "registrationFormats">) {
  const fields = resolveFields(event);
  return z.object({
    lastName: z.string().trim().min(1, "Введите фамилию").max(60),
    firstName: z.string().trim().min(1, "Введите имя").max(60),
    middleName: fields.middleName ? optText(60) : z.any().transform(() => null),
    email: z.string().trim().toLowerCase().email("Введите корректный e-mail").max(200),
    phone: z
      .string({ error: "Введите телефон" })
      .transform((v, ctx) => {
        const phone = normalizePhone(v);
        if (!phone) ctx.addIssue({ code: "custom", message: "Введите номер в формате +7 (900) 000-00-00" });
        return phone ?? "";
      }),
    specialtyId: z.string({ error: "Выберите специальность" }).min(1, "Выберите специальность"),
    workplace: fields.workplace ? optText(300) : z.any().transform(() => null),
    position: fields.position ? optText(200) : z.any().transform(() => null),
    city: z.string().trim().min(1, "Введите город").max(100),
    format: z.enum(participationFormats, { error: "Выберите формат участия" }).refine((f) => event.registrationFormats.includes(f), {
      message: "Этот формат недоступен для мероприятия",
    }),
    consentPersonalData: z.literal(true, { error: "Нужно согласие на обработку персональных данных" }),
    consentMailing: fields.mailingConsent ? z.boolean().default(false) : z.any().transform(() => false),
  });
}

export type RegistrationInput = z.infer<ReturnType<typeof registrationInputSchema>>;

type AvailabilityEvent = Pick<
  Event,
  "status" | "deletedAt" | "archivedAt" | "startDate" | "endDate" | "registrationEnabled" | "registrationDeadline" | "maxParticipants"
>;

export type Availability = {
  open: boolean;
  reason: "open" | "disabled" | "deadline" | "started" | "full" | "unpublished" | "archived";
  taken: number;
  limit: number | null;
};

export function computeAvailability(event: AvailabilityEvent, taken: number, now = new Date()): Availability {
  const base = { taken, limit: event.maxParticipants };
  if (event.deletedAt || event.archivedAt || event.endDate < todayDateOnly()) return { ...base, open: false, reason: "archived" };
  if (event.status !== "PUBLISHED") return { ...base, open: false, reason: "unpublished" };
  if (!event.registrationEnabled) return { ...base, open: false, reason: "disabled" };
  if (event.registrationDeadline ? now >= event.registrationDeadline : event.startDate <= todayDateOnly()) {
    return { ...base, open: false, reason: event.registrationDeadline ? "deadline" : "started" };
  }
  if (event.maxParticipants !== null && taken >= event.maxParticipants) return { ...base, open: false, reason: "full" };
  return { ...base, open: true, reason: "open" };
}

export function takenWhere(eventId: string): Prisma.RegistrationWhereInput {
  return { eventId, status: { not: "REJECTED" } };
}

const closedMessages: Record<Exclude<Availability["reason"], "open">, string> = {
  disabled: "Регистрация закрыта",
  deadline: "Регистрация завершена",
  started: "Регистрация завершена",
  full: "Регистрация завершена: все места заняты",
  unpublished: "Мероприятие не опубликовано",
  archived: "Мероприятие уже прошло",
};

export async function createRegistration(
  eventId: string,
  body: unknown,
  opts: { source: RegistrationSource; userId?: string; enforceAvailability: boolean },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) throw new HttpError(404, "Мероприятие не найдено");

    const input = registrationInputSchema(event).parse(body);

    if (opts.enforceAvailability) {
      const taken = await tx.registration.count({ where: takenWhere(event.id) });
      const availability = computeAvailability(event, taken);
      if (!availability.open) throw new HttpError(409, closedMessages[availability.reason as Exclude<Availability["reason"], "open">]);
    }

    const specialty = await tx.specialty.findUnique({ where: { id: input.specialtyId } });
    if (!specialty || (!specialty.isActive && opts.source === "SITE")) {
      throw new HttpError(400, "Специальность не найдена", { specialtyId: "Выберите специальность из списка" });
    }

    if (await tx.registration.findUnique({ where: { eventId_email: { eventId: event.id, email: input.email } } })) {
      throw new HttpError(409, "С этим e-mail уже есть заявка на это мероприятие", {
        email: "С этим e-mail уже есть заявка на это мероприятие",
      });
    }

    const { consentPersonalData, ...rest } = input;
    return tx.registration.create({
      data: {
        ...rest,
        eventId: event.id,
        specialtyName: specialty.name,
        consentPersonalData,
        consentAt: new Date(),
        source: opts.source,
        createdById: opts.userId,
      },
    });
  });
}
