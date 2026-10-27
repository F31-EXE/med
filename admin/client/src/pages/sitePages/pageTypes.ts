export type PageGroup = "main" | "service" | "sveden";
export type PageKind = "text" | "home" | "about";

export type PageListItem = {
  key: string;
  group: PageGroup;
  title: string;
  path: string | null;
  hint: string | null;
  updatedAt: string | null;
  filled: boolean;
  hasSeo: boolean;
};

export type Person = { name: string; position: string | null; photoUrl: string | null; photoThumbUrl: string | null };
export type Review = Person & { quote: string };

export type PageDetail = {
  key: string;
  group: PageGroup;
  kind: PageKind;
  hint: string | null;
  defaultTitle: string;
  pathEditable: boolean;
  defaultPath: string | null;
  title: string;
  path: string | null;
  body: string | null;
  blocks: { heroTitle?: string | null; heroSubtitle?: string | null; heroButtonText?: string | null; team?: Person[]; reviews?: Review[] };
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string | null;
};

export const groupLabels: Record<PageGroup, string> = {
  main: "Основные страницы",
  service: "Служебные страницы",
  sveden: "Сведения об образовательной организации",
};
