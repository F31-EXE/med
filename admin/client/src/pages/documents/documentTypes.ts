export type DocumentItem = {
  id: string;
  publicId: string;
  url: string;
  title: string;
  description: string | null;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  fileUpdatedAt: string;
  eventId: string | null;
  eventSection: "MAIN" | "RESULTS";
  event: { id: string; title: string; startDate: string } | null;
  svedenSection: string | null;
  sectionTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SvedenSection = { key: string; title: string; count: number };

export const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";
export const MAX_SIZE = 20 * 1024 * 1024;

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

export const typeColors: Record<string, string> = {
  pdf: "#D9363E",
  doc: "#2B579A",
  docx: "#2B579A",
  xls: "#217346",
  xlsx: "#217346",
};

export function absoluteUrl(url: string) {
  return `${window.location.origin}${url}`;
}
