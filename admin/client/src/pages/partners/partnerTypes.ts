export type PartnerBrief = { id: string; name: string; url: string | null; logoThumbUrl: string | null };

export type Partner = PartnerBrief & {
  description: string | null;
  logoUrl: string | null;
  showOnHome: boolean;
  homeSortOrder: number;
  eventsCount: number;
};

export type PartnerLevel = "ORGANIZER" | "GENERAL" | "OFFICIAL" | "INFO";

export const levelLabels: Record<PartnerLevel, string> = {
  ORGANIZER: "Организаторы",
  GENERAL: "Генеральный партнёр",
  OFFICIAL: "Официальные партнёры",
  INFO: "Информационные партнёры",
};

export const levelShort: Record<PartnerLevel, string> = {
  ORGANIZER: "Организатор",
  GENERAL: "Генеральный",
  OFFICIAL: "Официальный",
  INFO: "Информационный",
};

export const levels: PartnerLevel[] = ["ORGANIZER", "GENERAL", "OFFICIAL", "INFO"];

export const checker = "repeating-conic-gradient(#f5f5f5 0% 25%, #fff 0% 50%) 50% / 12px 12px";

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
