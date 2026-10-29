import type { AttendanceMode, EventFormat, EventSpeakerRole, PartnerLevel } from "../generated/prisma/client.js";

const monthsGen = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const monthsShort = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const monthsNom = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const weekdays = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export const formatLabels: Record<EventFormat, string> = {
  CONGRESS: "Конгресс",
  CONFERENCE: "Конференция",
  SEMINAR: "Семинар",
  EXHIBITION: "Выставка",
  ONLINE_SYMPOSIUM: "Онлайн-симпозиум",
};

export const formatPlural: Record<EventFormat, string> = {
  CONGRESS: "Медицинские конгрессы",
  CONFERENCE: "Научные конференции",
  SEMINAR: "Обучающие семинары",
  EXHIBITION: "Выставки медтехники",
  ONLINE_SYMPOSIUM: "Онлайн-симпозиумы",
};

export const modeLabels: Record<AttendanceMode, string> = {
  OFFLINE: "Очно",
  ONLINE: "Онлайн",
  HYBRID: "Очно и онлайн",
};

export const speakerRoleLabels: Record<EventSpeakerRole, string> = {
  CHAIR: "Председатель",
  CO_CHAIR: "Сопредседатель",
  COMMITTEE: "Научный комитет",
  SPEAKER: "Спикер",
};

export const partnerLevelLabels: Record<PartnerLevel, string> = {
  GENERAL: "Генеральный партнёр",
  OFFICIAL: "Официальные партнёры",
  INFO: "Информационные партнёры",
};

export const participationLabels: Record<string, string> = {
  OFFLINE: "Очное участие",
  ONLINE: "Онлайн-трансляция",
  EXHIBITOR: "Экспонент",
  SPEAKER: "Докладчик",
};

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

export function dateRange(start: string, end: string) {
  const a = parts(start);
  const b = parts(end);
  if (start.slice(0, 10) === end.slice(0, 10)) return `${a.d} ${monthsGen[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${monthsGen[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${a.d} ${monthsGen[a.m - 1]} – ${b.d} ${monthsGen[b.m - 1]} ${a.y}`;
  return `${a.d} ${monthsGen[a.m - 1]} ${a.y} – ${b.d} ${monthsGen[b.m - 1]} ${b.y}`;
}

export function dateBadge(start: string) {
  const a = parts(start);
  return { day: String(a.d).padStart(2, "0"), month: monthsShort[a.m - 1]!, year: a.y };
}

export function dayLabel(iso: string) {
  const a = parts(iso);
  const wd = weekdays[new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay()];
  return { date: `${a.d} ${monthsGen[a.m - 1]}`, weekday: wd! };
}

export function newsDate(value: Date | string | null, timeZone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(value));
}

export function isoDate(value: Date | string | null) {
  return value ? new Date(value).toISOString() : undefined;
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function rub(value: number | null) {
  if (value === null) return "По запросу";
  if (value === 0) return "Бесплатно";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function num(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

export function paragraphs(text: string | null | undefined) {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function lines(text: string | null | undefined) {
  if (!text) return [];
  return text
    .split(/\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits.startsWith("8") && digits.length === 11 ? `+7${digits.slice(1)}` : digits}`;
}

export function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, c) => String.fromCharCode(Number(c)))
    .replace(/\s+/g, " ")
    .trim();
}
