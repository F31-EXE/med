import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import type { DocumentItem, SvedenSection } from "./documentTypes";

export async function sendDocument(path: string, file: File, fields: Record<string, string | null | undefined> = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v) body.append(k, v);
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте подключение");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Ошибка ${res.status}`, data?.fields);
  return (data as { document: DocumentItem }).document;
}

export function useSvedenSections() {
  return useQuery({
    queryKey: ["documents", "sections"],
    queryFn: () => api<{ sections: SvedenSection[] }>("/documents/sections").then((r) => r.sections),
    staleTime: 30 * 1000,
  });
}
