import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Flex,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { MailOutlined, PlusOutlined } from "@ant-design/icons";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { roleLabels, type Role } from "../auth/roles";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type Filters = { q?: string; role?: Role; status?: "active" | "inactive" };

const roleOptions = (Object.keys(roleLabels) as Role[]).map((value) => ({ value, label: roleLabels[value] }));
const roleColors: Record<Role, string> = { ADMIN: "blue", EDITOR: "green", REGISTRATION_MANAGER: "orange" };

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

function toQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

function applyFieldErrors(form: ReturnType<typeof Form.useForm>[0], e: unknown) {
  if (e instanceof ApiError && e.fields) {
    form.setFields(Object.entries(e.fields).map(([name, error]) => ({ name, errors: [error] })));
  }
}

export function UsersPage() {
  const { user: me } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [filters, setFilters] = useState<Filters>({});
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [form] = Form.useForm();

  const users = useQuery({
    queryKey: ["users", filters],
    queryFn: () => api<{ users: AdminUser[] }>(`/users${toQuery(filters)}`).then((r) => r.users),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const save = useMutation({
    mutationFn: (values: { email?: string; name: string; role: Role }) =>
      editing === "new"
        ? api("/users", { body: values })
        : api(`/users/${(editing as AdminUser).id}`, { method: "PATCH", body: { name: values.name, role: values.role } }),
    onSuccess: () => {
      message.success(editing === "new" ? "Сотрудник добавлен, приглашение отправлено на e-mail" : "Изменения сохранены");
      setEditing(null);
      invalidate();
    },
    onError: (e) => {
      applyFieldErrors(form, e);
      if (!(e instanceof ApiError && e.fields)) message.error(e.message);
    },
  });

  const toggleActive = useMutation({
    mutationFn: (u: AdminUser) => api(`/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } }),
    onSuccess: (_d, u) => {
      message.success(u.isActive ? "Учётная запись отключена" : "Учётная запись включена");
      invalidate();
    },
    onError: (e) => message.error(e.message),
  });

  const sendLink = useMutation({
    mutationFn: (u: AdminUser) => api(`/users/${u.id}/send-link`, { method: "POST" }),
    onSuccess: (_d, u) => message.success(`Ссылка для входа отправлена на ${u.email}`),
    onError: (e) => message.error(e.message),
  });

  function openForm(target: AdminUser | "new") {
    setEditing(target);
    form.resetFields();
    form.setFieldsValue(target === "new" ? { role: "EDITOR" } : { name: target.name, role: target.role, email: target.email });
  }

  const isNew = editing === "new";
  const editingSelf = editing !== null && editing !== "new" && editing.id === me?.id;

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Пользователи
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm("new")}>
          Добавить сотрудника
        </Button>
      </Flex>

      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Имя или e-mail"
          allowClear
          onSearch={(q) => setFilters((f) => ({ ...f, q: q || undefined }))}
          style={{ width: screens.md ? 280 : "100%" }}
        />
        <Select
          placeholder="Все роли"
          allowClear
          options={roleOptions}
          onChange={(role) => setFilters((f) => ({ ...f, role }))}
          style={{ width: screens.md ? 220 : "100%" }}
        />
        <Select
          placeholder="Любой статус"
          allowClear
          options={[
            { value: "active", label: "Активные" },
            { value: "inactive", label: "Отключённые" },
          ]}
          onChange={(status) => setFilters((f) => ({ ...f, status }))}
          style={{ width: screens.md ? 180 : "100%" }}
        />
      </Flex>

      <Table<AdminUser>
        rowKey="id"
        loading={users.isPending}
        dataSource={users.data}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: users.isError ? users.error.message : "Никого не найдено" }}
        columns={[
          {
            title: "Сотрудник",
            render: (_, u) => (
              <>
                <div>
                  {u.name}
                  {u.id === me?.id && <Typography.Text type="secondary"> (вы)</Typography.Text>}
                </div>
                <Typography.Text type="secondary">{u.email}</Typography.Text>
              </>
            ),
          },
          {
            title: "Роль",
            dataIndex: "role",
            render: (role: Role) => <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>,
          },
          {
            title: "Статус",
            render: (_, u) =>
              !u.isActive ? (
                <Tag>Отключён</Tag>
              ) : u.lastLoginAt ? (
                <Tag color="success">Активен</Tag>
              ) : (
                <Tag color="processing">Приглашён</Tag>
              ),
          },
          {
            title: "Последний вход",
            dataIndex: "lastLoginAt",
            render: (v: string | null) => (v ? dateFormat.format(new Date(v)) : "—"),
          },
          {
            title: "",
            align: "right",
            render: (_, u) => (
              <Space wrap>
                <Button size="small" onClick={() => openForm(u)}>
                  Изменить
                </Button>
                {u.isActive && (
                  <Button
                    size="small"
                    icon={<MailOutlined />}
                    loading={sendLink.isPending && sendLink.variables?.id === u.id}
                    onClick={() => sendLink.mutate(u)}
                  >
                    {u.lastLoginAt ? "Сброс пароля" : "Приглашение"}
                  </Button>
                )}
                {u.id !== me?.id && (
                  <Popconfirm
                    title={u.isActive ? "Отключить учётную запись?" : "Включить учётную запись?"}
                    description={u.isActive ? "Сотрудник сразу потеряет доступ к админ-панели." : undefined}
                    okText={u.isActive ? "Отключить" : "Включить"}
                    cancelText="Отмена"
                    onConfirm={() => toggleActive.mutateAsync(u)}
                  >
                    <Button size="small" danger={u.isActive}>
                      {u.isActive ? "Отключить" : "Включить"}
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={editing !== null}
        title={isNew ? "Новый сотрудник" : "Изменить сотрудника"}
        okText={isNew ? "Добавить и отправить приглашение" : "Сохранить"}
        cancelText="Отмена"
        confirmLoading={save.isPending}
        onOk={() => form.submit()}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
          <Form.Item
            label="E-mail"
            name="email"
            extra={isNew ? "На этот адрес придёт ссылка, чтобы задать пароль." : undefined}
            rules={[
              { required: true, message: "Введите e-mail" },
              { type: "email", message: "Введите корректный e-mail" },
            ]}
          >
            <Input type="email" inputMode="email" disabled={!isNew} />
          </Form.Item>
          <Form.Item label="Имя и фамилия" name="name" rules={[{ required: true, min: 2, message: "Введите имя" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Роль"
            name="role"
            rules={[{ required: true, message: "Выберите роль" }]}
            extra={editingSelf ? "Собственную роль изменить нельзя." : undefined}
          >
            <Select options={roleOptions} disabled={editingSelf} />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Администратор — все разделы, включая настройки и пользователей. Редактор — мероприятия, программа, спикеры,
          новости, партнёры, документы и страницы. Менеджер регистрации — только заявки.
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
