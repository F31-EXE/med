export type RegistrationStatus = "NEW" | "CONFIRMED" | "REJECTED";
export type ParticipationFormat = "OFFLINE" | "ONLINE" | "EXHIBITOR" | "SPEAKER";

export type Registration = {
  id: string;
  eventId: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  email: string;
  phone: string;
  specialtyId: string | null;
  specialtyName: string;
  workplace: string | null;
  position: string | null;
  city: string;
  format: ParticipationFormat;
  snils: string | null;
  consentPersonalData: boolean;
  consentAt: string;
  consentMailing: boolean;
  status: RegistrationStatus;
  statusChangedAt: string | null;
  source: "SITE" | "MANUAL";
  managerComment: string | null;
  createdAt: string;
  event: { id: string; title: string; startDate: string };
};

export type RegistrationFields = {
  middleName: boolean;
  workplace: boolean;
  position: boolean;
  snils: boolean;
  mailingConsent: boolean;
};

export type RegistrationSettings = {
  registrationEnabled: boolean;
  registrationDeadline: string | null;
  maxParticipants: number | null;
  showRegistrationCount: boolean;
  registrationFormats: ParticipationFormat[];
  registrationFields: RegistrationFields;
  confirmationText: string | null;
};

export type AvailabilityReason = "open" | "disabled" | "deadline" | "started" | "full" | "unpublished" | "archived";

export type RegistrationEvent = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  startDate: string;
  endDate: string;
  nmoPoints: number | null;
  counts: Record<RegistrationStatus, number>;
  availability: { open: boolean; reason: AvailabilityReason; taken: number; limit: number | null };
  settings: RegistrationSettings;
};

export const statusLabels: Record<RegistrationStatus, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  REJECTED: "Отклонена",
};

export const statusColors: Record<RegistrationStatus, string> = {
  NEW: "processing",
  CONFIRMED: "success",
  REJECTED: "default",
};

export const formatLabels: Record<ParticipationFormat, string> = {
  OFFLINE: "Очно",
  ONLINE: "Онлайн",
  EXHIBITOR: "Экспонент",
  SPEAKER: "Докладчик",
};

export const availabilityLabels: Record<AvailabilityReason, string> = {
  open: "Регистрация открыта",
  disabled: "Регистрация закрыта вручную",
  deadline: "Регистрация завершена по дате",
  started: "Мероприятие началось",
  full: "Все места заняты",
  unpublished: "Мероприятие не опубликовано",
  archived: "Мероприятие прошло",
};

export const fieldLabels: Record<keyof RegistrationFields, string> = {
  middleName: "Отчество",
  workplace: "Место работы",
  position: "Должность",
  snils: "СНИЛС (для НМО)",
  mailingConsent: "Согласие на рассылку",
};

export function fullName(r: Pick<Registration, "lastName" | "firstName" | "middleName">) {
  return [r.lastName, r.firstName, r.middleName].filter(Boolean).join(" ");
}

export function formatPhone(value: string) {
  const m = value.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}` : value;
}

export const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });
