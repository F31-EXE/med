import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button, Dropdown, Flex, Grid, Input, InputNumber, Modal, Segmented, Select, Space, Table, Tag, Typography } from "antd";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { dictionaryOptions, useDictionary } from "../../api/dictionaries";
import { formatDateRange, formatLabels, formatOptions, type EventListItem } from "./eventTypes";
import { useEventActions } from "./useEventActions";

type Tab = "upcoming" | "archive" | "trash";

const filterKeys = ["q", "status", "format", "directionId", "cityId", "year"] as const;

export function StatusTags({ item }: { item: Pick<EventListItem, "status" | "state"> }) {
  return (
    <Space size={4} wrap>
      {item.status === "PUBLISHED" ? <Tag color="success">Опубликовано</Tag> : <Tag>Черновик</Tag>}
      {item.state === "archived" && <Tag color="default">Архив</Tag>}
      {item.state === "deleted" && <Tag color="error">В корзине</Tag>}
    </Space>
  );
}

export function EventsListPage() {
  const screens = Grid.useBreakpoint();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const directions = useDictionary("directions");
  const cities = useDictionary("cities");
  const actions = useEventActions();

  const tab = (params.get("tab") as Tab) || "upcoming";
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
  for (const k of filterKeys) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }

  const list = useQuery({
    queryKey: ["events", query.toString()],
    queryFn: () =>
      api<{ items: EventListItem[]; total: number; pageSize: number }>(`/events?${query.toString()}`),
    placeholderData: keepPreviousData,
  });

  const filterWidth = (w: number) => (screens.md ? w : "100%");

  function rowActions(item: EventListItem) {
    if (item.state === "deleted") {
      return (
        <Button size="small" onClick={() => actions.restore.mutate(item.id)}>
          Восстановить
        </Button>
      );
    }
    return (
      <Space>
        <Link to={`/events/${item.id}`}>
          <Button size="small">Открыть</Button>
        </Link>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "status",
                label: item.status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать",
              },
              { key: "copy", label: "Создать копию" },
              { key: "archive", label: item.state === "archived" ? "Вернуть из архива" : "Перенести в архив" },
              { type: "divider" },
              { key: "delete", label: "Удалить", danger: true },
            ],
            onClick: ({ key }) => {
              if (key === "status") actions.setStatus.mutate({ id: item.id, status: item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" });
              if (key === "copy") actions.copy.mutate(item.id);
              if (key === "archive") actions.setArchived.mutate({ id: item.id, archived: item.state !== "archived" });
              if (key === "delete") {
                Modal.confirm({
                  title: "Удалить мероприятие?",
                  content: `«${item.title}» попадёт в корзину. Восстановить его можно в течение 30 дней.`,
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
          Мероприятия
        </Typography.Title>
        <Link to="/events/new">
          <Button type="primary" icon={<PlusOutlined />}>
            Новое мероприятие
          </Button>
        </Link>
      </Flex>

      <Segmented<Tab>
        value={tab}
        onChange={(v) => update({ tab: v === "upcoming" ? undefined : v })}
        options={[
          { value: "upcoming", label: "Предстоящие" },
          { value: "archive", label: "Архив" },
          { value: "trash", label: "Корзина" },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Название"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(q) => update({ q })}
          style={{ width: filterWidth(260) }}
        />
        <Select
          placeholder="Статус"
          allowClear
          value={params.get("status") ?? undefined}
          onChange={(status) => update({ status })}
          options={[
            { value: "PUBLISHED", label: "Опубликовано" },
            { value: "DRAFT", label: "Черновик" },
          ]}
          style={{ width: filterWidth(160) }}
        />
        <Select
          placeholder="Формат"
          allowClear
          value={params.get("format") ?? undefined}
          onChange={(format) => update({ format })}
          options={formatOptions}
          style={{ width: filterWidth(180) }}
        />
        <Select
          placeholder="Направление"
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          value={params.get("directionId") ?? undefined}
          onChange={(directionId) => update({ directionId })}
          options={dictionaryOptions(directions.data, directions.data?.map((d) => d.id))}
          style={{ width: filterWidth(200) }}
        />
        <Select
          placeholder="Город"
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          value={params.get("cityId") ?? undefined}
          onChange={(cityId) => update({ cityId })}
          options={dictionaryOptions(cities.data, cities.data?.map((d) => d.id))}
          style={{ width: filterWidth(180) }}
        />
        <InputNumber
          placeholder="Год"
          min={2000}
          max={2100}
          value={params.get("year") ? Number(params.get("year")) : null}
          onChange={(year) => update({ year: year ?? undefined })}
          style={{ width: filterWidth(110) }}
        />
      </Flex>

      {tab === "trash" && (
        <Typography.Paragraph type="secondary">
          Удалённые мероприятия хранятся 30 дней, затем удаляются окончательно.
        </Typography.Paragraph>
      )}

      <Table<EventListItem>
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items}
        scroll={{ x: 900 }}
        locale={{ emptyText: list.isError ? list.error.message : "Мероприятий не найдено" }}
        pagination={{
          current: page,
          pageSize: list.data?.pageSize ?? 20,
          total: list.data?.total ?? 0,
          showSizeChanger: false,
          hideOnSinglePage: true,
          onChange: (p) => update({ page: p === 1 ? undefined : p }),
        }}
        columns={[
          {
            title: "Мероприятие",
            render: (_, item) => (
              <>
                {item.state === "deleted" ? (
                  <Typography.Text>{item.title}</Typography.Text>
                ) : (
                  <Link to={`/events/${item.id}`}>{item.title}</Link>
                )}
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {[formatLabels[item.format], ...item.directions.map((d) => d.name)].join(" · ")}
                  </Typography.Text>
                </div>
              </>
            ),
          },
          {
            title: "Даты",
            width: 190,
            render: (_, item) => formatDateRange(item.startDate, item.endDate, item.dateUnknown),
          },
          {
            title: "Место",
            width: 200,
            render: (_, item) => [item.city?.name, item.venueName].filter(Boolean).join(", ") || "—",
          },
          {
            title: "НМО",
            dataIndex: "nmoPoints",
            width: 70,
            align: "center",
            render: (v: number | null) => v ?? "—",
          },
          {
            title: "Статус",
            width: 170,
            render: (_, item) => (
              <>
                <StatusTags item={item} />
                {item.purgeAt && (
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                    удалится {new Date(item.purgeAt).toLocaleDateString("ru-RU")}
                  </Typography.Text>
                )}
              </>
            ),
          },
          { title: "", width: 150, align: "right", render: (_, item) => rowActions(item) },
        ]}
      />
    </>
  );
}
