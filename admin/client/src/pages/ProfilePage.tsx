import { useMutation } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Form, Input, Typography } from "antd";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { roleLabels } from "../auth/roles";

export function ProfilePage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const change = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      api("/auth/change-password", { body: values }),
    onSuccess: () => {
      message.success("Пароль изменён. Другие сеансы завершены");
      form.resetFields();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        form.setFields(Object.entries(e.fields).map(([name, error]) => ({ name, errors: [error] })));
      } else {
        message.error(e.message);
      }
    },
  });

  if (!user) return null;

  return (
    <>
      <Typography.Title level={2}>Профиль</Typography.Title>
      <Card style={{ maxWidth: 560, marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Имя">{user.name}</Descriptions.Item>
          <Descriptions.Item label="E-mail">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Роль">{roleLabels[user.role]}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Смена пароля" style={{ maxWidth: 560 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          disabled={change.isPending}
          onFinish={({ currentPassword, newPassword }) => change.mutate({ currentPassword, newPassword })}
        >
          <Form.Item label="Текущий пароль" name="currentPassword" rules={[{ required: true, message: "Введите текущий пароль" }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Новый пароль"
            name="newPassword"
            rules={[
              { required: true, message: "Введите новый пароль" },
              { min: 8, message: "Пароль должен быть не короче 8 символов" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Повторите новый пароль"
            name="confirm"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Повторите пароль" },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || getFieldValue("newPassword") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Пароли не совпадают")),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={change.isPending}>
            Сменить пароль
          </Button>
        </Form>
      </Card>
    </>
  );
}
