import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Form, Input, Result } from "antd";
import { api, ApiError } from "../api/client";
import { AuthCard } from "./AuthCard";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { password: string }) {
    setError(null);
    setLoading(true);
    try {
      await api("/auth/reset-password", { body: { token, password: values.password } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Новый пароль">
        <Result
          status="warning"
          title="Ссылка неполная"
          subTitle="Откройте ссылку из письма целиком или запросите восстановление ещё раз."
          extra={<Link to="/forgot-password">Запросить ссылку</Link>}
        />
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Новый пароль">
        <Result
          status="success"
          title="Пароль изменён"
          subTitle="Войдите с новым паролем. Все прежние сеансы завершены."
          extra={
            <Link to="/login">
              <Button type="primary">Войти</Button>
            </Link>
          }
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Новый пароль">
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false} disabled={loading}>
        <Form.Item
          label="Новый пароль"
          name="password"
          rules={[
            { required: true, message: "Введите пароль" },
            { min: 8, message: "Пароль должен быть не короче 8 символов" },
          ]}
        >
          <Input.Password autoComplete="new-password" autoFocus />
        </Form.Item>
        <Form.Item
          label="Повторите пароль"
          name="confirm"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Повторите пароль" },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Пароли не совпадают")),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Сохранить пароль
        </Button>
      </Form>
    </AuthCard>
  );
}
