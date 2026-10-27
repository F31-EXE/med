import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Form, Input, Result } from "antd";
import { api, ApiError } from "../api/client";
import { AuthCard } from "./AuthCard";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string }) {
    setError(null);
    setLoading(true);
    try {
      await api("/auth/forgot-password", { body: values });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось отправить запрос");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Восстановление пароля">
        <Result
          status="success"
          title="Проверьте почту"
          subTitle="Если такой e-mail зарегистрирован, мы отправили на него ссылку для смены пароля. Ссылка действует 1 час."
          extra={<Link to="/login">Вернуться ко входу</Link>}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Восстановление пароля">
      <p>Укажите e-mail, с которым вы входите в админ-панель. Мы пришлём ссылку для смены пароля.</p>
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
        <Button type="primary" htmlType="submit" block loading={loading}>
          Отправить ссылку
        </Button>
      </Form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Link to="/login">Вернуться ко входу</Link>
      </div>
    </AuthCard>
  );
}
