export type Role = "ADMIN" | "EDITOR" | "REGISTRATION_MANAGER";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "Администратор",
  EDITOR: "Редактор",
  REGISTRATION_MANAGER: "Менеджер регистрации",
};

const content: Role[] = ["ADMIN", "EDITOR"];

export const modules = [
  { key: "events", label: "Мероприятия", roles: content },
  { key: "speakers", label: "Спикеры", roles: content },
  { key: "registrations", label: "Регистрации", roles: ["ADMIN", "REGISTRATION_MANAGER"] as Role[] },
  { key: "news", label: "Новости", roles: content },
  { key: "partners", label: "Партнёры и клиенты", roles: content },
  { key: "documents", label: "Документы", roles: content },
  { key: "pages", label: "Страницы и SEO", roles: content },
  { key: "settings", label: "Настройки", roles: ["ADMIN"] as Role[] },
  { key: "users", label: "Пользователи", roles: ["ADMIN"] as Role[] },
] as const;

export type ModuleKey = (typeof modules)[number]["key"];

export function canAccess(role: Role, key: ModuleKey) {
  return modules.find((m) => m.key === key)!.roles.includes(role);
}
