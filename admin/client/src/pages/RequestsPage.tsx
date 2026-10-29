import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Flex, Grid, Input, Popconfirm, Segmented, Space, Table, Tag, Typography } from "antd";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { formatPhone } from "./registrations/registrationTypes";

type ContactRequest = {
  id: string;
  name: string;
  organization: string | null;
  phone: string | null;
  email: string | null;
  comment: string | null;
  source: string | null;
  status: "NEW" | "PROCESSED";
  managerComment: string | null;
  processedAt: string | null;
  createdAt: string;
};

const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export function RequestsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [status, setStatus] = useState<"all" | "NEW" | "PROCESSED">("NEW");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);

  const list = useQuery({
    queryKey: ["contact-requests", params.toString()],
    queryFn: () => api<{ items: ContactRequest[]; total: number; pageSize: number; newCount: number }>(`/contact-requests?${params}`),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: ContactRequest["status"]; managerComment?: string | null }) =>
      api(`/contact-requests/${id}`, { method: "PATCH", body }),
    onSuccess: refresh,
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/contact-requests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      message.success("Обращение удалено");
      refresh();
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <Typography.Title level={2}>Обращения</Typography.Title>
      <Typography.Paragraph type="secondary">Заявки из форм обратной связи на сайте: имя, контакт, комментарий.</Typography.Paragraph>
      <Flex wrap gap={12} align="center" style={{ marginBottom: 16 }}>
        <Segmented
          value={status}
          onChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
          options={[
            { value: "NEW", label: `Новые${list.data ? ` · ${list.data.newCount}` : ""}` },
            { value: "PROCESSED", label: "Обработанные" },
            { value: "all", label: "Все" },
          ]}
        />
        <Input.Search
          placeholder="Имя, организация, телефон, e-mail"
          allowClear
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
          style={{ width: screens.md ? 320 : "100%" }}
        />
      </Flex>
      <Table<ContactRequest>
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items}
        scroll={{ x: 860 }}
        locale={{ emptyText: list.isError ? list.error.message : "Обращений нет" }}
        pagination={{
          current: page,
          pageSize: list.data?.pageSize ?? 30,
          total: list.data?.total ?? 0,
          hideOnSinglePage: true,
          showSizeChanger: false,
          onChange: setPage,
        }}
        expandable={{
          rowExpandable: () => true,
          expandedRowRender: (r) => (
            <Flex vertical gap={8} style={{ maxWidth: 640 }}>
              <Typography.Text type="secondary">Комментарий менеджера</Typography.Text>
              <Input.TextArea
                defaultValue={r.managerComment ?? ""}
                autoSize={{ minRows: 2, maxRows: 6 }}
                maxLength={2000}
                onBlur={(e) => e.target.value !== (r.managerComment ?? "") && update.mutate({ id: r.id, managerComment: e.target.value })}
                placeholder="Сохраняется, когда поле теряет фокус"
              />
            </Flex>
          ),
        }}
        columns={[
          {
            title: "Обращение",
            render: (_, r) => (
              <>
                <div>
                  <b>{r.name}</b>
                  {r.organization ? ` · ${r.organization}` : ""}
                </div>
                <Space size={12} wrap style={{ fontSize: 13 }}>
                  {r.phone && <a href={`tel:${r.phone}`}>{formatPhone(r.phone)}</a>}
                  {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}
                </Space>
                {r.comment && (
                  <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0", fontSize: 13, whiteSpace: "pre-line" }}>
                    {r.comment}
                  </Typography.Paragraph>
                )}
              </>
            ),
          },
          {
            title: "Получено",
            width: 150,
            render: (_, r) => (
              <>
                {dateTime.format(new Date(r.createdAt))}
                {r.source && (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {r.source}
                    </Typography.Text>
                  </div>
                )}
              </>
            ),
          },
          {
            title: "Статус",
            width: 130,
            render: (_, r) => (r.status === "NEW" ? <Tag color="processing">Новое</Tag> : <Tag color="success">Обработано</Tag>),
          },
          {
            title: "",
            width: 220,
            align: "right",
            render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => update.mutate({ id: r.id, status: r.status === "NEW" ? "PROCESSED" : "NEW" })}>
                  {r.status === "NEW" ? "Обработано" : "Вернуть в новые"}
                </Button>
                {user?.role === "ADMIN" && (
                  <Popconfirm title="Удалить обращение?" okText="Удалить" cancelText="Отмена" onConfirm={() => remove.mutateAsync(r.id)}>
                    <Button size="small" danger type="text">
                      Удалить
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
    </>
  );
}
