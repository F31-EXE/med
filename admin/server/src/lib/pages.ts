import { z } from "zod";
import { svedenSections } from "./documents.js";

export type PageKind = "text" | "home" | "about";
export type PageGroup = "main" | "service" | "sveden";

export type PageDef = {
  key: string;
  group: PageGroup;
  title: string;
  defaultPath: string | null;
  pathEditable: boolean;
  kind: PageKind;
  hint?: string;
};

export const pageDefs: PageDef[] = [
  { key: "home", group: "main", title: "Главная", defaultPath: "/", pathEditable: false, kind: "home", hint: "Первый экран; ближайшие мероприятия, цифры и новости подставляются автоматически" },
  { key: "about", group: "main", title: "О компании", defaultPath: "/about", pathEditable: true, kind: "about", hint: "История, команда, отзывы; цифры компании берутся из настроек" },
  { key: "events", group: "main", title: "Мероприятия", defaultPath: "/events", pathEditable: false, kind: "text", hint: "Вводный текст над каталогом и SEO каталога" },
  { key: "news", group: "main", title: "Новости", defaultPath: "/news", pathEditable: false, kind: "text", hint: "Вводный текст над лентой и SEO ленты" },
  { key: "contacts", group: "main", title: "Контакты", defaultPath: "/contacts", pathEditable: true, kind: "text", hint: "Телефоны, адрес и реквизиты берутся из настроек; здесь — дополнительный текст" },
  { key: "privacy", group: "service", title: "Политика конфиденциальности", defaultPath: "/privacy", pathEditable: true, kind: "text" },
  { key: "consent", group: "service", title: "Согласие на обработку персональных данных", defaultPath: "/consent", pathEditable: true, kind: "text" },
  { key: "thanks", group: "service", title: "Спасибо, заявка принята", defaultPath: "/thanks", pathEditable: true, kind: "text" },
  { key: "search", group: "service", title: "Поиск по сайту", defaultPath: "/search", pathEditable: true, kind: "text" },
  { key: "not-found", group: "service", title: "Страница не найдена (404)", defaultPath: null, pathEditable: false, kind: "text" },
  { key: "sveden", group: "sveden", title: "Сведения об образовательной организации", defaultPath: "/sveden", pathEditable: false, kind: "text" },
  ...svedenSections.map((s) => ({
    key: `sveden-${s.key}`,
    group: "sveden" as const,
    title: s.title,
    defaultPath: `/sveden/${s.key}`,
    pathEditable: false,
    kind: "text" as const,
    hint: "Если сведений нет, оставьте пояснение — подраздел должен существовать",
  })),
];

export function findPageDef(key: string) {
  return pageDefs.find((p) => p.key === key);
}

export const reservedPrefixes = ["/events", "/news", "/sveden", "/files", "/uploads", "/api", "/admin", "/assets", "/a11y"];

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);

const photo = z
  .string()
  .regex(/^\/uploads\/[\w/.-]+\.webp$/, "Некорректная ссылка на фото")
  .nullish()
  .transform((v) => v || null);

export const blockSchemas: Record<PageKind, z.ZodType> = {
  text: z.object({}).strip().default({}),
  home: z
    .object({
      heroTitle: opt(200),
      heroSubtitle: opt(500),
      heroButtonText: opt(60),
    })
    .default({ heroTitle: null, heroSubtitle: null, heroButtonText: null }),
  about: z
    .object({
      team: z
        .array(
          z.object({
            name: z.string({ error: "Введите имя" }).trim().min(1, "Введите имя").max(120),
            position: opt(200),
            photoUrl: photo,
            photoThumbUrl: photo,
          }),
        )
        .max(50, "Не больше 50 человек")
        .default([]),
      reviews: z
        .array(
          z.object({
            quote: z.string({ error: "Введите текст отзыва" }).trim().min(1, "Введите текст отзыва").max(2000),
            name: z.string({ error: "Введите автора" }).trim().min(1, "Введите автора").max(120),
            position: opt(200),
            photoUrl: photo,
            photoThumbUrl: photo,
          }),
        )
        .max(30, "Не больше 30 отзывов")
        .default([]),
    })
    .default({ team: [], reviews: [] }),
};

export function emptyBlocks(kind: PageKind) {
  return blockSchemas[kind].parse(undefined);
}
