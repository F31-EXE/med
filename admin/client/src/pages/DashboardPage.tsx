import { Card, Typography } from "antd";
import { useAuth } from "../auth/AuthProvider";
import { roleLabels } from "../auth/roles";

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <Typography.Title level={2}>Здравствуйте, {user?.name}</Typography.Title>
      <Card>
        <Typography.Paragraph>
          Вы вошли как <b>{user && roleLabels[user.role]}</b>. Разделы, доступные вашей роли, перечислены в меню.
        </Typography.Paragraph>
      </Card>
    </>
  );
}

export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <>
      <Typography.Title level={2}>{title}</Typography.Title>
      <Card>
        <Typography.Text type="secondary">Раздел в разработке.</Typography.Text>
      </Card>
    </>
  );
}
