import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Flex, Grid, Input, Popconfirm, Space, Table, Typography } from "antd";
import { PlusOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { SpeakerFormModal } from "./SpeakerFormModal";
import { speakerCaption, type Speaker } from "./speakerTypes";

export function SpeakersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Speaker | "new" | null>(null);

  const list = useQuery({
    queryKey: ["speakers", "list", q, page],
    queryFn: () =>
      api<{ items: Speaker[]; total: number; pageSize: number }>(`/speakers?page=${page}&q=${encodeURIComponent(q)}`),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/speakers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      message.success("Спикер удалён");
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Спикеры
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
          Добавить спикера
        </Button>
      </Flex>
      <Typography.Paragraph type="secondary">
        Общий справочник: один спикер подключается к любому числу мероприятий и сессий программы.
      </Typography.Paragraph>
      <Input.Search
        placeholder="ФИО или место работы"
        allowClear
        onSearch={(v) => {
          setQ(v);
          setPage(1);
        }}
        style={{ width: screens.md ? 320 : "100%", marginBottom: 16 }}
      />
      <Table<Speaker>
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items}
        scroll={{ x: 720 }}
        locale={{ emptyText: list.isError ? list.error.message : "Спикеров не найдено" }}
        pagination={{
          current: page,
          pageSize: list.data?.pageSize ?? 20,
          total: list.data?.total ?? 0,
          hideOnSinglePage: true,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "Спикер",
            render: (_, s) => (
              <Flex gap={12} align="center">
                <Avatar size={48} src={s.photoThumbUrl ?? undefined} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
                <div>
                  <a onClick={() => setEditing(s)}>{s.fullName}</a>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {speakerCaption(s) || "—"}
                    </Typography.Text>
                  </div>
                </div>
              </Flex>
            ),
          },
          { title: "Город", dataIndex: "city", width: 160, render: (v: string | null) => v ?? "—" },
          {
            title: "Участие",
            width: 170,
            render: (_, s) =>
              s.usage.events || s.usage.sessions ? (
                <Typography.Text style={{ fontSize: 13 }}>
                  мероприятий: {s.usage.events}
                  <br />
                  сессий: {s.usage.sessions}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">не участвует</Typography.Text>
              ),
          },
          {
            title: "",
            width: 200,
            align: "right",
            render: (_, s) => (
              <Space>
                <Button size="small" onClick={() => setEditing(s)}>
                  Изменить
                </Button>
                <Popconfirm
                  title="Удалить спикера?"
                  description={s.usage.events || s.usage.sessions ? "Он указан в мероприятиях — сначала уберите его оттуда." : undefined}
                  okText="Удалить"
                  cancelText="Отмена"
                  onConfirm={() => remove.mutateAsync(s.id)}
                >
                  <Button size="small" danger>
                    Удалить
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <SpeakerFormModal open={editing !== null} speaker={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}
