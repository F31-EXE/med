import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export type DictionaryType = "directions" | "cities" | "specialties";

export type DictionaryItem = {
  id: string;
  name: string;
  isActive: boolean;
  usage: number;
};

export const dictionaryLabels: Record<DictionaryType, { title: string; single: string }> = {
  directions: { title: "Направления", single: "направление" },
  cities: { title: "Города", single: "город" },
  specialties: { title: "Специальности", single: "специальность" },
};

export function useDictionary(type: DictionaryType) {
  return useQuery({
    queryKey: ["dictionaries", type],
    queryFn: () => api<{ items: DictionaryItem[] }>(`/dictionaries/${type}`).then((r) => r.items),
    staleTime: 60 * 1000,
  });
}

export function dictionaryOptions(items: DictionaryItem[] | undefined, keepIds: string[] = []) {
  return (items ?? [])
    .filter((i) => i.isActive || keepIds.includes(i.id))
    .map((i) => ({ value: i.id, label: i.isActive ? i.name : `${i.name} (отключено)` }));
}
