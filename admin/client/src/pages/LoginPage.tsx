import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input } from "antd";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../api/client";
import { AuthCard } from "./AuthCard";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Вход">
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false} disabled={loading}>
        <Form.Item
          label="E-mail"
          name="email"
          rules={[
            { required: true, message: "Введите e-mail" },
            { type: "email", message: "Введите корректный e-mail" },
          ]}
        >
          <Input type="email" autoComplete="username" autoFocus inputMode="email" />
        </Form.Item>
        <Form.Item label="Пароль" name="password" rules={[{ required: true, message: "Введите пароль" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Войти
        </Button>
      </Form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Link to="/forgot-password">Забыли пароль?</Link>
      </div>
    </AuthCard>
  );
}
