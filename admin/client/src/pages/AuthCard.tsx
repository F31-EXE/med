import type { ReactNode } from "react";
import { Card, Typography } from "antd";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#F3F6FA",
      }}
    >
      <Card style={{ width: "100%", maxWidth: 400 }}>
        <Typography.Text type="secondary">Media Expo Group · админ-панель</Typography.Text>
        <Typography.Title level={3} style={{ marginTop: 4 }}>
          {title}
        </Typography.Title>
        {children}
      </Card>
    </div>
  );
}
