import type { SpeakerBrief } from "../../speakers/speakerTypes";

export type Hall = { id: string; name: string; sortOrder: number };

export type SessionSpeakerRole = "MODERATOR" | "SPEAKER";

export type ProgramSession = {
  id: string;
  dayId: string;
  hallId: string | null;
  kind: "SESSION" | "BREAK";
  startTime: string;
  endTime: string;
  title: string;
  description: string | null;
  nmo: boolean;
  speakers: { speakerId: string; role: SessionSpeakerRole; speaker: SpeakerBrief }[];
};

export type ProgramDay = { id: string; date: string; title: string | null; sessions: ProgramSession[] };

export type Program = {
  event: { startDate: string; endDate: string };
  halls: Hall[];
  days: ProgramDay[];
};

export const sessionRoleLabels: Record<SessionSpeakerRole, string> = {
  MODERATOR: "Модератор",
  SPEAKER: "Докладчик",
};

const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatDayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d} ${months[m - 1]}, ${weekdays[wd]}`;
}
