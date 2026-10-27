import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Empty, Flex, Grid, Input, Popconfirm, Segmented, Space, Switch, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { SortableList } from "../../components/SortableList";
import { PartnerFormModal } from "./PartnerFormModal";
import { PartnerLogo } from "./PartnerLogo";
import { hostOf, type Partner } from "./partnerTypes";

type View = "all" | "home";

export function PartnersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [editing, setEditing] = useState<Partner | "new" | null>(null);
  const view = (params.get("view") as View) || "all";
  const page = Number(params.get("page") || 1);
  const q = params.get("q") ?? "";

  function update(patch: Record<string, string | number | undefined | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  }

  const listKey = ["partners", "list", view, q, page];
  const list = useQuery({
    queryKey: listKey,
    queryFn: () =>
      api<{ items: Partner[]; total: number; pageSize: number }>(
        view === "home" ? "/partners?home=true" : `/partners?page=${page}&q=${encodeURIComponent(q)}`,
      ),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["partners"] });

  const toggleHome = useMutation({
    mutationFn: (p: Partner) =>
      api(`/partners/${p.id}`, {
        method: "PUT",
        body: { name: p.name, url: p.url, description: p.description, logoUrl: p.logoUrl, logoThumbUrl: p.logoThumbUrl, showOnHome: !p.showOnHome },
      }),
    onSuccess: refresh,
    onError: (e) => message.error(e.message),
  });

  const reorderHome = useMutation({
    mutationFn: (ids: string[]) => api("/partners/home-order", { method: "PUT", body: { ids } }),
    onError: (e) => {
      message.error(e.message);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/partners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      message.success("Партнёр удалён");
      refresh();
    },
    onError: (e) => message.error(e.message),
  });

  const actions = (p: Partner) => (
    <Space>
      <Button size="small" onClick={() => setEditing(p)}>
        Изменить
      </Button>
      <Popconfirm
        title="Удалить партнёра?"
        description={p.eventsCount ? "Он указан в мероприятиях — сначала уберите его оттуда." : undefined}
        okText="Удалить"
        cancelText="Отмена"
        onConfirm={() => remove.mutateAsync(p.id)}
      >
        <Button size="small" danger>
          Удалить
        </Button>
      </Popconfirm>
    </Space>
  );

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Партнёры и клиенты
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
          Добавить партнёра
        </Button>
      </Flex>
      <Typography.Paragraph type="secondary">
        Общий справочник логотипов. К мероприятию партнёры подключаются на его вкладке «Партнёры» с уровнем: генеральный, официальный или информационный.
      </Typography.Paragraph>

      <Flex wrap gap={12} align="center" style={{ marginBottom: 16 }}>
        <Segmented<View>
          value={view}
          onChange={(v) => update({ view: v === "all" ? undefined : v, q: undefined })}
          options={[
            { value: "all", label: "Все" },
            { value: "home", label: "Лента на главной" },
          ]}
        />
        {view === "all" && (
          <Input.Search
            placeholder="Название или сайт"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => update({ q: v })}
            style={{ width: screens.md ? 280 : "100%" }}
          />
        )}
      </Flex>

      {view === "home" ? (
        <Card size="small">
          <Typography.Paragraph type="secondary">Порядок логотипов в ленте на главной странице. Меняется перетаскиванием.</Typography.Paragraph>
          {list.data?.items.length ? (
            <SortableList
              items={list.data.items}
              getId={(p) => p.id}
              onReorder={(next) => {
                queryClient.setQueryData<{ items: Partner[] }>(listKey, (old) => (old ? { ...old, items: next } : old));
                reorderHome.mutate(next.map((p) => p.id));
              }}
              renderItem={(p, handle) => (
                <Flex align="center" gap={12} style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
                  {handle}
                  <PartnerLogo partner={p} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {p.name}
                    {p.url && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {hostOf(p.url)}
                        </Typography.Text>
                      </div>
                    )}
                  </div>
                  <Button size="small" onClick={() => toggleHome.mutate(p)}>
                    Убрать из ленты
                  </Button>
                </Flex>
              )}
            />
          ) : (
            <Empty description="В ленте пока никого. Отметьте партнёров переключателем в списке «Все»" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      ) : (
        <Table<Partner>
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 760 }}
          locale={{ emptyText: list.isError ? list.error.message : "Партнёров не найдено" }}
          pagination={{
            current: page,
            pageSize: list.data?.pageSize ?? 30,
            total: list.data?.total ?? 0,
            hideOnSinglePage: true,
            showSizeChanger: false,
            onChange: (p) => update({ page: p === 1 ? undefined : p }),
          }}
          columns={[
            {
              title: "Партнёр",
              render: (_, p) => (
                <Flex gap={12} align="center">
                  <PartnerLogo partner={p} />
                  <div style={{ minWidth: 0 }}>
                    <a onClick={() => setEditing(p)}>{p.name}</a>
                    {p.url && (
                      <div>
                        <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#8c8c8c" }}>
                          {hostOf(p.url)}
                        </a>
                      </div>
                    )}
                  </div>
                </Flex>
              ),
            },
            {
              title: "Мероприятий",
              dataIndex: "eventsCount",
              width: 120,
              align: "center",
            },
            {
              title: "На главной",
              width: 120,
              align: "center",
              render: (_, p) => (
                <Switch
                  size="small"
                  checked={p.showOnHome}
                  loading={toggleHome.isPending && toggleHome.variables?.id === p.id}
                  onChange={() => toggleHome.mutate(p)}
                  aria-label="Показывать на главной"
                />
              ),
            },
            { title: "", width: 200, align: "right", render: (_, p) => actions(p) },
          ]}
        />
      )}

      <PartnerFormModal open={editing !== null} partner={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}
