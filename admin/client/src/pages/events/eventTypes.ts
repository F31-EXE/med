export type EventFormat = "CONGRESS" | "CONFERENCE" | "SEMINAR" | "EXHIBITION" | "ONLINE_SYMPOSIUM";
export type AttendanceMode = "OFFLINE" | "ONLINE" | "HYBRID";
export type EventStatus = "DRAFT" | "PUBLISHED";
export type EventState = "upcoming" | "archived" | "deleted";

export const formatLabels: Record<EventFormat, string> = {
  CONGRESS: "Конгресс",
  CONFERENCE: "Конференция",
  SEMINAR: "Семинар",
  EXHIBITION: "Выставка",
  ONLINE_SYMPOSIUM: "Онлайн-симпозиум",
};

export const modeLabels: Record<AttendanceMode, string> = {
  OFFLINE: "Очно",
  ONLINE: "Онлайн",
  HYBRID: "Очно и онлайн",
};

export const formatOptions = (Object.keys(formatLabels) as EventFormat[]).map((value) => ({ value, label: formatLabels[value] }));
export const modeOptions = (Object.keys(modeLabels) as AttendanceMode[]).map((value) => ({ value, label: modeLabels[value] }));

type Ref = { id: string; name: string };

export type EventListItem = {
  id: string;
  title: string;
  slug: string;
  format: EventFormat;
  attendanceMode: AttendanceMode;
  status: EventStatus;
  state: EventState;
  startDate: string;
  endDate: string;
  city: Ref | null;
  directions: Ref[];
  nmoPoints: number | null;
  venueName: string | null;
  deletedAt: string | null;
  purgeAt: string | null;
  updatedAt: string;
};

export type Tariff = {
  id?: string;
  name: string;
  audience: string | null;
  price: number | null;
  includes: string | null;
};

export type EventDetail = EventListItem & {
  subtitle: string | null;
  cityId: string | null;
  directionIds: string[];
  expectedParticipants: number | null;
  description: string | null;
  keyFacts: { value: string; label: string }[];
  organizers: string | null;
  venueAddress: string | null;
  venueHowToGet: string | null;
  venueParking: string | null;
  venueAccommodation: string | null;
  venueLat: number | null;
  venueLng: number | null;
  registrationEnabled: boolean;
  registrationDeadline: string | null;
  maxParticipants: number | null;
  showRegistrationCount: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  archivedAt: string | null;
  publishedAt: string | null;
  tariffs: Tariff[];
};

const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatDateRange(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (start === end) return `${sd} ${months[sm - 1]} ${sy}`;
  if (sy === ey && sm === em) return `${sd}–${ed} ${months[sm - 1]} ${sy}`;
  if (sy === ey) return `${sd} ${months[sm - 1]} – ${ed} ${months[em - 1]} ${sy}`;
  return `${sd} ${months[sm - 1]} ${sy} – ${ed} ${months[em - 1]} ${ey}`;
}
