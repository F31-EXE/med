import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Drawer, Grid, Layout, Menu, Space, Typography } from "antd";
import { LogoutOutlined, MenuOutlined } from "@ant-design/icons";
import { useAuth } from "./auth/AuthProvider";
import { modules, roleLabels } from "./auth/roles";

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) return null;

  const items = modules
    .filter((m) => (m.roles as readonly string[]).includes(user.role))
    .map((m) => ({ key: `/${m.key}`, label: m.label }));
  const selected = "/" + location.pathname.split("/")[1];

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={[{ key: "/", label: "Главная" }, ...items]}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
      style={{ borderInlineEnd: 0 }}
    />
  );

  const brand = (
    <div style={{ padding: "16px 24px", fontWeight: 600 }}>
      Media Expo Group
      <Typography.Text type="secondary" style={{ display: "block", fontWeight: 400, fontSize: 12 }}>
        админ-панель
      </Typography.Text>
    </div>
  );

  const isDesktop = screens.lg;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isDesktop ? (
        <Sider width={240} theme="light" style={{ borderInlineEnd: "1px solid #f0f0f0" }}>
          {brand}
          {menu}
        </Sider>
      ) : (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size={260}
          styles={{ body: { padding: 0 } }}
          title={null}
          closable={false}
        >
          {brand}
          {menu}
        </Drawer>
      )}
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          {isDesktop ? <span /> : <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} aria-label="Меню" />}
          <Space size="middle">
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, textAlign: "right" }}>
              <span>{user.name}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {roleLabels[user.role]}
              </Typography.Text>
            </div>
            <Button
              icon={<LogoutOutlined />}
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
            >
              {isDesktop ? "Выйти" : null}
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: isDesktop ? 24 : 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
