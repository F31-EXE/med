export type NewsState = "draft" | "scheduled" | "published" | "deleted";

export type NewsImage = { id?: string; url: string; thumbUrl: string; caption: string | null };

type EventRef = { id: string; title: string; startDate: string };

export type NewsListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverThumbUrl: string | null;
  event: EventRef | null;
  status: "DRAFT" | "PUBLISHED";
  state: NewsState;
  publishAt: string | null;
  imagesCount: number;
  updatedAt: string;
  deletedAt: string | null;
  purgeAt: string | null;
};

export type News = Omit<NewsListItem, "imagesCount"> & {
  body: string | null;
  coverUrl: string | null;
  eventId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  images: NewsImage[];
};

export const stateLabels: Record<NewsState, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  published: "Опубликована",
  deleted: "В корзине",
};

export const stateColors: Record<NewsState, string> = {
  draft: "default",
  scheduled: "warning",
  published: "success",
  deleted: "error",
};

export const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });
