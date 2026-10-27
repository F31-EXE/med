import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Flex, Form, Input, Popconfirm, Space, Switch, Table, Tabs, Typography } from "antd";
import { CheckOutlined, CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "../api/client";
import { applyFieldErrors } from "../api/forms";
import { dictionaryLabels, useDictionary, type DictionaryItem, type DictionaryType } from "../api/dictionaries";
import { ContactsSettings, NotificationsSettings, NumbersSettings } from "./settings/SiteSettingsTabs";

const hints: Record<DictionaryType, string> = {
  directions: "Медицинские направления для мероприятий и фильтра каталога на сайте.",
  cities: "Города проведения мероприятий и фильтр каталога на сайте.",
  specialties: "Выпадающий список «Специальность» в форме регистрации участника.",
};

function DictionaryTable({ type }: { type: DictionaryType }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const items = useDictionary(type);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const label = dictionaryLabels[type];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dictionaries", type] });

  const add = useMutation({
    mutationFn: (name: string) => api(`/dictionaries/${type}`, { body: { name } }),
    onSuccess: () => {
      addForm.resetFields();
      invalidate();
    },
    onError: (e) => {
      if (!applyFieldErrors(addForm, e)) message.error(e.message);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; isActive?: boolean }) =>
      api(`/dictionaries/${type}/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (e) => {
      if (!applyFieldErrors(editForm, e)) message.error(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/dictionaries/${type}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <Typography.Paragraph type="secondary">{hints[type]}</Typography.Paragraph>
      <Form form={addForm} layout="inline" onFinish={({ name }) => add.mutate(name)} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="name" rules={[{ required: true, min: 2, message: "Введите название" }]} style={{ flex: "1 1 240px" }}>
          <Input placeholder={`Новое значение: ${label.single}`} maxLength={100} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={add.isPending}>
          Добавить
        </Button>
      </Form>
      <Table<DictionaryItem>
        rowKey="id"
        size="middle"
        loading={items.isPending}
        dataSource={items.data}
        pagination={false}
        locale={{ emptyText: "Пока пусто" }}
        columns={[
          {
            title: "Название",
            render: (_, item) =>
              editingId === item.id ? (
                <Form
                  form={editForm}
                  layout="inline"
                  initialValues={{ name: item.name }}
                  onFinish={({ name }) => update.mutate({ id: item.id, name })}
                >
                  <Form.Item name="name" rules={[{ required: true, min: 2, message: "Введите название" }]} style={{ marginInlineEnd: 8 }}>
                    <Input autoFocus maxLength={100} />
                  </Form.Item>
                  <Space>
                    <Button htmlType="submit" type="primary" icon={<CheckOutlined />} loading={update.isPending} aria-label="Сохранить" />
                    <Button icon={<CloseOutlined />} onClick={() => setEditingId(null)} aria-label="Отмена" />
                  </Space>
                </Form>
              ) : (
                <Typography.Text type={item.isActive ? undefined : "secondary"}>{item.name}</Typography.Text>
              ),
          },
          ...(type !== "specialties"
            ? [{ title: "Мероприятий", dataIndex: "usage", width: 130, align: "center" as const }]
            : []),
          {
            title: "Активно",
            width: 100,
            align: "center",
            render: (_, item) => (
              <Switch
                size="small"
                checked={item.isActive}
                loading={update.isPending && update.variables?.id === item.id && update.variables.isActive !== undefined}
                onChange={(isActive) => update.mutate({ id: item.id, isActive })}
                aria-label="Активно"
              />
            ),
          },
          {
            title: "",
            width: 220,
            align: "right",
            render: (_, item) =>
              editingId === item.id ? null : (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      editForm.resetFields();
                      setEditingId(item.id);
                    }}
                  >
                    Переименовать
                  </Button>
                  <Popconfirm
                    title="Удалить значение?"
                    description={item.usage > 0 ? "Оно используется — удалить не получится, лучше отключите." : undefined}
                    okText="Удалить"
                    cancelText="Отмена"
                    onConfirm={() => remove.mutateAsync(item.id)}
                  >
                    <Button size="small" danger>
                      Удалить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
        scroll={{ x: 560 }}
      />
    </>
  );
}

export function SettingsPage() {
  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Настройки
        </Typography.Title>
      </Flex>
      <Card>
        <Tabs
          destroyOnHidden
          items={[
            { key: "contacts", label: "Контакты", children: <ContactsSettings /> },
            { key: "numbers", label: "Цифры компании", children: <NumbersSettings /> },
            { key: "notifications", label: "Уведомления", children: <NotificationsSettings /> },
            ...(Object.keys(dictionaryLabels) as DictionaryType[]).map((type) => ({
              key: type,
              label: dictionaryLabels[type].title,
              children: <DictionaryTable type={type} />,
            })),
          ]}
        />
      </Card>
    </>
  );
}
