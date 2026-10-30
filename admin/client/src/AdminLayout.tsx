import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Badge, Button, Drawer, Grid, Layout, Menu, Space, Typography } from "antd";
import {
  AppstoreOutlined,
  CalendarOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  NotificationOutlined,
  ProfileOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { api } from "./api/client";
import { useAuth } from "./auth/AuthProvider";
import { modules, roleLabels, type ModuleKey } from "./auth/roles";
import { colors } from "./theme";
import { siteUrl } from "./siteUrl";

const { Header, Sider, Content } = Layout;

const icons: Record<ModuleKey, ReactNode> = {
  events: <CalendarOutlined />,
  speakers: <SolutionOutlined />,
  registrations: <UsergroupAddOutlined />,
  requests: <MailOutlined />,
  news: <NotificationOutlined />,
  partners: <TeamOutlined />,
  documents: <FolderOpenOutlined />,
  pages: <FileTextOutlined />,
  settings: <SettingOutlined />,
  users: <UserOutlined />,
};

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: size * 0.32,
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.mint})`,
        display: "grid",
        placeItems: "center",
        position: "relative",
      }}
    >
      <span style={{ position: "absolute", width: size * 0.46, height: size * 0.14, background: "#fff", borderRadius: 3 }} />
      <span style={{ position: "absolute", width: size * 0.14, height: size * 0.46, background: "#fff", borderRadius: 3 }} />
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const allowed = modules.filter((m) => user && (m.roles as readonly string[]).includes(user.role));
  const newRegistrations = useQuery({
    queryKey: ["registrations", "new-count"],
    queryFn: () => api<{ count: number }>("/registrations/new-count").then((r) => r.count),
    enabled: allowed.some((m) => m.key === "registrations"),
    refetchInterval: 60 * 1000,
  });

  if (!user) return null;

  const items = allowed.map((m) => ({
    key: `/${m.key}`,
    icon: icons[m.key],
    label:
      m.key === "registrations" && newRegistrations.data ? (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {m.label}
          <Badge count={newRegistrations.data} overflowCount={99} title={`Новых заявок: ${newRegistrations.data}`} />
        </span>
      ) : (
        m.label
      ),
  }));
  const selected = "/" + location.pathname.split("/")[1];

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={[{ key: "/", label: "Главная", icon: <AppstoreOutlined /> }, ...items]}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
      style={{ borderInlineEnd: 0, background: "transparent" }}
    />
  );

  const brand = (
    <div style={{ padding: "20px 20px 16px" }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, color: colors.ink }}>
        <BrandMark />
        <span style={{ lineHeight: 1.15 }}>
          <span style={{ display: "block", fontFamily: "Nunito, Inter, sans-serif", fontWeight: 900, fontSize: 17 }}>Media Expo Group</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            админ-панель
          </Typography.Text>
        </span>
      </Link>
      <a
        href={siteUrl("/")}
        target="_blank"
        rel="noreferrer"
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "9px 12px",
          borderRadius: 999,
          background: colors.mintSoft,
          color: colors.mintDark,
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Открыть сайт <ExportOutlined />
      </a>
    </div>
  );

  const isDesktop = screens.lg;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isDesktop ? (
        <Sider width={256} style={{ borderInlineEnd: `1px solid ${colors.line}`, position: "sticky", top: 0, height: "100vh", overflow: "auto" }}>
          {brand}
          {menu}
        </Sider>
      ) : (
        <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} size={280} styles={{ body: { padding: 0 } }} title={null} closable={false}>
          {brand}
          {menu}
        </Drawer>
      )}
      <Layout>
        <Header
          style={{
            padding: isDesktop ? "0 24px" : "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${colors.line}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
            backdropFilter: "blur(8px)",
          }}
        >
          {isDesktop ? (
            <span />
          ) : (
            <Space>
              <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} aria-label="Меню" />
              <Link to="/">
                <BrandMark size={34} />
              </Link>
            </Space>
          )}
          <Space size="middle">
            <Link to="/profile" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
              {isDesktop ? (
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, textAlign: "right" }}>
                  <span style={{ fontWeight: 600 }}>{user.name}</span>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {roleLabels[user.role]}
                  </Typography.Text>
                </span>
              ) : null}
              <Avatar style={{ background: colors.mintSoft, color: colors.mintDark, fontWeight: 700 }} icon={user.name ? undefined : <ProfileOutlined />}>
                {initials(user.name)}
              </Avatar>
            </Link>
            <Button
              icon={<LogoutOutlined />}
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              aria-label="Выйти"
            >
              {isDesktop ? "Выйти" : null}
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: isDesktop ? 28 : 14, maxWidth: 1480, width: "100%", margin: "0 auto" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
