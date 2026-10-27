import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider, Result } from "antd";
import ruRU from "antd/locale/ru_RU";
import { AuthProvider } from "./auth/AuthProvider";
import { GuestOnly, RequireAuth, RequireModule } from "./auth/guards";
import { modules } from "./auth/roles";
import { AdminLayout } from "./AdminLayout";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage, ModulePlaceholder } from "./pages/DashboardPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: "#0B5ED7", fontSize: 15 } }}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route element={<GuestOnly />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                </Route>
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route element={<RequireAuth />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<DashboardPage />} />
                    {modules.map((m) => (
                      <Route key={m.key} element={<RequireModule module={m.key} />}>
                        <Route path={`/${m.key}/*`} element={<ModulePlaceholder title={m.label} />} />
                      </Route>
                    ))}
                    <Route path="*" element={<Result status="404" title="Страница не найдена" />} />
                  </Route>
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
