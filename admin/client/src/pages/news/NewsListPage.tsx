import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Dropdown, Flex, Grid, Input, Segmented, Space, Table, Tag, Typography } from "antd";
import { MoreOutlined, PictureOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { EventSelect } from "../../components/EventSelect";
import { dateTime, stateColors, stateLabels, type NewsListItem } from "./newsTypes";

type Tab = "all" | "draft" | "scheduled" | "published" | "trash";

export function NewsStateTag({ item }: { item: Pick<NewsListItem, "state" | "publishAt"> }) {
  return (
    <>
      <Tag color={stateColors[item.state]}>{stateLabels[item.state]}</Tag>
      {item.publishAt && (item.state === "scheduled" || item.state === "published") && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
          {item.state === "scheduled" ? "на " : ""}
          {dateTime.format(new Date(item.publishAt))}
        </Typography.Text>
      )}
    </>
  );
}

export function useNewsActions() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["news"] });
    queryClient.invalidateQueries({ queryKey: ["news-item"] });
  };
  const onError = (e: Error) => message.error(e.message);
  return {
    publish: useMutation({
      mutationFn: (id: string) => api(`/news/${id}/publish`, { body: {} }),
      onSuccess: () => {
        message.success("Новость опубликована");
        refresh();
      },
      onError,
    }),
    unpublish: useMutation({
      mutationFn: (id: string) => api(`/news/${id}/unpublish`, { method: "POST" }),
      onSuccess: () => {
        message.success("Новость снята с публикации");
        refresh();
      },
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api(`/news/${id}`, { method: "DELETE" }),
      onSuccess: () => {
        message.success("Новость в корзине. Её можно восстановить в течение 30 дней");
        refresh();
      },
      onError,
    }),
    restore: useMutation({
      mutationFn: (id: string) => api(`/news/${id}/restore`, { method: "POST" }),
      onSuccess: () => {
        message.success("Новость восстановлена");
        refresh();
      },
      onError,
    }),
  };
}

export function NewsListPage() {
  const { modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const actions = useNewsActions();

  const tab = (params.get("tab") as Tab) || "all";
  const page = Number(params.get("page") || 1);

  function update(patch: Record<string, string | number | undefined | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ tab, page: String(page) });
  for (const k of ["q", "eventId"]) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }

  const list = useQuery({
    queryKey: ["news", query.toString()],
    queryFn: () =>
      api<{ items: NewsListItem[]; total: number; pageSize: number; counts: Record<Exclude<Tab, "all">, number> }>(`/news?${query.toString()}`),
    placeholderData: keepPreviousData,
  });
  const c = list.data?.counts;

  function rowActions(item: NewsListItem) {
    if (item.state === "deleted") {
      return (
        <Button size="small" onClick={() => actions.restore.mutate(item.id)}>
          Восстановить
        </Button>
      );
    }
    return (
      <Space>
        <Link to={`/news/${item.id}`}>
          <Button size="small">Открыть</Button>
        </Link>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              item.state === "draft" ? { key: "publish", label: "Опубликовать сейчас" } : { key: "unpublish", label: "Снять с публикации" },
              { type: "divider" },
              { key: "delete", label: "Удалить", danger: true },
            ],
            onClick: ({ key }) => {
              if (key === "publish") actions.publish.mutate(item.id);
              if (key === "unpublish") actions.unpublish.mutate(item.id);
              if (key === "delete") {
                modal.confirm({
                  title: "Удалить новость?",
                  content: `«${item.title}» попадёт в корзину. Восстановить её можно в течение 30 дней.`,
                  okText: "Удалить",
                  okButtonProps: { danger: true },
                  cancelText: "Отмена",
                  onOk: () => actions.remove.mutateAsync(item.id),
                });
              }
            },
          }}
        >
          <Button size="small" icon={<MoreOutlined />} aria-label="Действия" />
        </Dropdown>
      </Space>
    );
  }

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Новости
        </Typography.Title>
        <Link to="/news/new">
          <Button type="primary" icon={<PlusOutlined />}>
            Новая новость
          </Button>
        </Link>
      </Flex>

      <Segmented<Tab>
        value={tab}
        onChange={(v) => update({ tab: v === "all" ? undefined : v })}
        options={[
          { value: "all", label: "Все" },
          { value: "published", label: `Опубликованные${c ? ` · ${c.published}` : ""}` },
          { value: "scheduled", label: `Запланированные${c ? ` · ${c.scheduled}` : ""}` },
          { value: "draft", label: `Черновики${c ? ` · ${c.draft}` : ""}` },
          { value: "trash", label: `Корзина${c ? ` · ${c.trash}` : ""}` },
        ]}
        style={{ marginBottom: 16, maxWidth: "100%", overflowX: "auto" }}
      />

      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Заголовок или анонс"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(q) => update({ q })}
          style={{ width: screens.md ? 280 : "100%" }}
        />
        <div style={{ width: screens.md ? 520 : "100%", maxWidth: "100%" }}>
          <EventSelect value={params.get("eventId")} onChange={(eventId) => update({ eventId })} placeholder="Любое мероприятие" />
        </div>
      </Flex>

      {tab === "trash" && (
        <Typography.Paragraph type="secondary">Удалённые новости хранятся 30 дней, затем удаляются окончательно.</Typography.Paragraph>
      )}

      <Table<NewsListItem>
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items}
        scroll={{ x: 820 }}
        locale={{ emptyText: list.isError ? list.error.message : "Новостей не найдено" }}
        pagination={{
          current: page,
          pageSize: list.data?.pageSize ?? 20,
          total: list.data?.total ?? 0,
          hideOnSinglePage: true,
          showSizeChanger: false,
          onChange: (p) => update({ page: p === 1 ? undefined : p }),
        }}
        columns={[
          {
            title: "Новость",
            render: (_, n) => (
              <Flex gap={12} align="center">
                <Avatar shape="square" size={64} src={n.coverThumbUrl ?? undefined} icon={<PictureOutlined />} style={{ flexShrink: 0, borderRadius: 6 }} />
                <div style={{ minWidth: 0 }}>
                  {n.state === "deleted" ? <Typography.Text>{n.title}</Typography.Text> : <Link to={`/news/${n.id}`}>{n.title}</Link>}
                  {n.excerpt && (
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ margin: 0, fontSize: 13 }}>
                      {n.excerpt}
                    </Typography.Paragraph>
                  )}
                  {n.imagesCount > 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Галерея: {n.imagesCount} фото
                    </Typography.Text>
                  )}
                </div>
              </Flex>
            ),
          },
          {
            title: "Мероприятие",
            width: 220,
            render: (_, n) => (n.event ? <Link to={`/events/${n.event.id}`}>{n.event.title}</Link> : <Typography.Text type="secondary">—</Typography.Text>),
          },
          {
            title: "Статус",
            width: 190,
            render: (_, n) => (
              <>
                <NewsStateTag item={n} />
                {n.purgeAt && (
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                    удалится {new Date(n.purgeAt).toLocaleDateString("ru-RU")}
                  </Typography.Text>
                )}
              </>
            ),
          },
          { title: "", width: 150, align: "right", render: (_, n) => rowActions(n) },
        ]}
      />
    </>
  );
}

