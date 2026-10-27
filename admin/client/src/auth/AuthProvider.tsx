import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import type { User } from "./roles";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ME_KEY = ["auth", "me"];

async function fetchMe() {
  try {
    const { user } = await api<{ user: User }>("/auth/me");
    return user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60 * 1000, retry: false });

  const loginMutation = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: User }>("/auth/login", { body }).then((r) => r.user),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
    },
  });

  const value: AuthContextValue = {
    user: me.data ?? null,
    isLoading: me.isPending,
    login: (email, password) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return ctx;
}
