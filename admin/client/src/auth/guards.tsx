import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Result, Spin } from "antd";
import { useAuth } from "./AuthProvider";
import { canAccess, type ModuleKey } from "./roles";

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function GuestOnly() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RequireModule({ module }: { module: ModuleKey }) {
  const { user } = useAuth();
  if (!user || !canAccess(user.role, module)) {
    return <Result status="403" title="Нет доступа" subTitle="У вашей роли нет прав на этот раздел." />;
  }
  return <Outlet />;
}
