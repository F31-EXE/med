import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  App,
  Button,
  Card,
  DatePicker,
  Flex,
  Grid,
  Input,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DownloadOutlined, MessageOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { dictionaryOptions, useDictionary } from "../../api/dictionaries";
import { formatDateRange } from "../events/eventTypes";
import { RegistrationDrawer } from "./RegistrationDrawer";
import { RegistrationFormModal } from "./RegistrationFormModal";
import { RegistrationSettingsDrawer } from "./RegistrationSettingsDrawer";
import {
  availabilityLabels,
  dateTime,
  formatLabels,
  formatPhone,
  fullName,
  statusColors,
  statusLabels,
  type ParticipationFormat,
  type Registration,
  type RegistrationEvent,
  type RegistrationStatus,
} from "./registrationTypes";

const filterKeys = ["eventId", "status", "format", "specialtyId", "source", "from", "to", "q"] as const;

function EventSummary({ event, onSettings, onAdd }: { event: RegistrationEvent; onSettings: () => void; onAdd: () => void }) {
  const { taken, limit, open, reason } = event.availability;
  const deadline = event.settings.registrationDeadline;
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Flex justify="space-between" align="center" wrap gap={12}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <Typography.Text strong>{event.title}</Typography.Text>
          <Typography.Text type="secondary"> · {formatDateRange(event.startDate, event.endDate)}</Typography.Text>
          <Flex align="center" gap={12} wrap style={{ marginTop: 8 }}>
            <Tag color={open ? "success" : "default"}>{availabilityLabels[reason]}</Tag>
            {open && deadline && <Typography.Text type="secondary">до {dateTime.format(new Date(deadline))}</Typography.Text>}
            <Typography.Text>
              Занято мест: <b>{taken}</b>
              {limit !== null && <> из {limit}</>}
            </Typography.Text>
            {limit !== null && (
              <Progress
                percent={Math.min(100, Math.round((taken / limit) * 100))}
                size="small"
                status={taken >= limit ? "exception" : "normal"}
                style={{ width: 140, margin: 0 }}
                showInfo={false}
              />
            )}
          </Flex>
        </div>
        <Space wrap>
          <Button icon={<SettingOutlined />} onClick={onSettings}>
            Настройки регистрации
          </Button>
          <Button icon={<PlusOutlined />} onClick={onAdd}>
            Добавить заявку
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}

export function RegistrationsPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [opened, setOpened] = useState<Registration | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const specialties = useDictionary("specialties");

  const page = Number(params.get("page") || 1);
  const eventId = params.get("eventId") ?? undefined;
  const status = (params.get("status") as RegistrationStatus | null) ?? undefined;

  function update(patch: Record<string, string | number | undefined | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
    setSelected([]);
  }

  const filterQuery = new URLSearchParams();
  for (const k of filterKeys) {
    const v = params.get(k);
    if (v) filterQuery.set(k, v);
  }

  const events = useQuery({
    queryKey: ["registration-events"],
    queryFn: () => api<{ events: RegistrationEvent[] }>("/registrations/events").then((r) => r.events),
  });
  const currentEvent = events.data?.find((e) => e.id === eventId) ?? null;

  const list = useQuery({
    queryKey: ["registrations", filterQuery.toString(), page],
    queryFn: () =>
      api<{ items: Registration[]; total: number; pageSize: number; counts: Record<RegistrationStatus, number> }>(
        `/registrations?${filterQuery.toString()}&page=${page}`,
      ),
    placeholderData: keepPreviousData,
  });

  const bulk = useMutation({
    mutationFn: (s: RegistrationStatus) => api<{ updated: number }>("/registrations/bulk-status", { body: { ids: selected, status: s } }),
    onSuccess: ({ updated }, s) => {
      message.success(`${statusLabels[s]}: ${updated}`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registration-events"] });
    },
    onError: (e) => message.error(e.message),
  });

  const quickStatus = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: RegistrationStatus }) =>
      api(`/registrations/${id}`, { method: "PATCH", body: { status: s } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registration-events"] });
    },
    onError: (e) => message.error(e.message),
  });

  const counts = list.data?.counts ?? { NEW: 0, CONFIRMED: 0, REJECTED: 0 };
  const all = counts.NEW + counts.CONFIRMED + counts.REJECTED;
  const w = (px: number) => (screens.md ? px : "100%");
  const exportHref = `/api/registrations/export?${filterQuery.toString()}`;

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Регистрации
        </Typography.Title>
        <a href={exportHref} download>
          <Button type="primary" icon={<DownloadOutlined />} disabled={!list.data?.total}>
            Выгрузить в Excel{list.data?.total ? ` (${list.data.total})` : ""}
          </Button>
        </a>
      </Flex>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
          Мероприятие
        </Typography.Text>
        <Flex gap={12} wrap align="center">
          <Select
            placeholder="Все мероприятия — выберите, чтобы увидеть заявки на конкретное"
            allowClear
            showSearch={{ optionFilterProp: "title" }}
            value={eventId}
            onChange={(v) => update({ eventId: v })}
            loading={events.isPending}
            style={{ width: w(560) }}
            popupMatchSelectWidth={false}
            options={(["upcoming", "past"] as const)
              .map((group) => ({
                label: group === "upcoming" ? "Предстоящие" : "Прошедшие",
                options: (events.data ?? [])
                  .filter((e) => (e.endDate >= dayjs().format("YYYY-MM-DD")) === (group === "upcoming"))
                  .sort((a, b) => (group === "upcoming" ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)))
                  .map((e) => {
                    const total = e.counts.NEW + e.counts.CONFIRMED + e.counts.REJECTED;
                    return {
                      value: e.id,
                      title: e.title,
                      label: (
                        <Flex justify="space-between" gap={16}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {e.title}
                            {e.status === "DRAFT" && <Typography.Text type="secondary"> (черновик)</Typography.Text>}
                          </span>
                          <Typography.Text type="secondary" style={{ flexShrink: 0 }}>
                            {dayjs(e.startDate).format("DD.MM.YYYY")} · заявок: {total}
                            {e.counts.NEW ? `, новых: ${e.counts.NEW}` : ""}
                          </Typography.Text>
                        </Flex>
                      ),
                    };
                  }),
              }))
              .filter((g) => g.options.length)}
          />
          {eventId && (
            <Button type="link" onClick={() => update({ eventId: undefined })} style={{ padding: 0 }}>
              Показать все мероприятия
            </Button>
          )}
        </Flex>
      </Card>

      {currentEvent && <EventSummary event={currentEvent} onSettings={() => setSettingsOpen(true)} onAdd={() => setAdding(true)} />}
      {!currentEvent && (
        <Typography.Paragraph type="secondary">Выберите мероприятие, чтобы увидеть лимит мест, изменить настройки регистрации или добавить заявку вручную.</Typography.Paragraph>
      )}

      <Segmented<string>
        value={status ?? "all"}
        onChange={(v) => update({ status: v === "all" ? undefined : v })}
        options={[
          { value: "all", label: `Все · ${all}` },
          { value: "NEW", label: `Новые · ${counts.NEW}` },
          { value: "CONFIRMED", label: `Подтверждённые · ${counts.CONFIRMED}` },
          { value: "REJECTED", label: `Отклонённые · ${counts.REJECTED}` },
        ]}
        style={{ marginBottom: 16, maxWidth: "100%", overflowX: "auto" }}
      />

      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="ФИО, e-mail, телефон, место работы"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(q) => update({ q })}
          style={{ width: w(300) }}
        />
        <Select
          placeholder="Формат участия"
          allowClear
          value={params.get("format") ?? undefined}
          onChange={(v) => update({ format: v })}
          options={(Object.keys(formatLabels) as ParticipationFormat[]).map((value) => ({ value, label: formatLabels[value] }))}
          style={{ width: w(170) }}
        />
        <Select
          placeholder="Специальность"
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          value={params.get("specialtyId") ?? undefined}
          onChange={(v) => update({ specialtyId: v })}
          options={dictionaryOptions(specialties.data, specialties.data?.map((s) => s.id))}
          style={{ width: w(200) }}
        />
        <DatePicker.RangePicker
          format="DD.MM.YYYY"
          placeholder={["Заявки с", "по"]}
          value={params.get("from") && params.get("to") ? [dayjs(params.get("from")), dayjs(params.get("to"))] : null}
          onChange={(v) => update({ from: v?.[0]?.format("YYYY-MM-DD"), to: v?.[1]?.format("YYYY-MM-DD") })}
          style={{ width: w(260) }}
        />
        <Select
          placeholder="Источник"
          allowClear
          value={params.get("source") ?? undefined}
          onChange={(v) => update({ source: v })}
          options={[
            { value: "SITE", label: "С сайта" },
            { value: "MANUAL", label: "Вручную" },
          ]}
          style={{ width: w(140) }}
        />
      </Flex>

      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
        Порядок: сначала новые заявки, затем подтверждённые и отклонённые; внутри статуса — от свежих к старым.
      </Typography.Paragraph>

      {selected.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: "#F3F6FA" }}>
          <Space wrap>
            <Typography.Text>Выбрано: {selected.length}</Typography.Text>
            <Button size="small" type="primary" onClick={() => bulk.mutate("CONFIRMED")} loading={bulk.isPending}>
              Подтвердить
            </Button>
            <Button
              size="small"
              danger
              loading={bulk.isPending}
              onClick={() =>
                modal.confirm({
                  title: `Отклонить заявки: ${selected.length}?`,
                  content: "Отклонённые заявки не занимают места.",
                  okText: "Отклонить",
                  okButtonProps: { danger: true },
                  cancelText: "Отмена",
                  onOk: () => bulk.mutateAsync("REJECTED"),
                })
              }
            >
              Отклонить
            </Button>
            <Button size="small" onClick={() => bulk.mutate("NEW")} loading={bulk.isPending}>
              Вернуть в новые
            </Button>
            <Button size="small" type="text" onClick={() => setSelected([])}>
              Снять выбор
            </Button>
          </Space>
        </Card>
      )}

      <Table<Registration>
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items}
        scroll={{ x: 1000 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]), preserveSelectedRowKeys: false }}
        onRow={(r) => ({ onDoubleClick: () => setOpened(r) })}
        locale={{ emptyText: list.isError ? list.error.message : "Заявок не найдено" }}
        pagination={{
          current: page,
          pageSize: list.data?.pageSize ?? 50,
          total: list.data?.total ?? 0,
          showSizeChanger: false,
          hideOnSinglePage: true,
          showTotal: (t) => `Всего: ${t}`,
          onChange: (p) => update({ page: p === 1 ? undefined : p }),
        }}
        columns={[
          {
            title: "Участник",
            render: (_, r) => (
              <>
                <a onClick={() => setOpened(r)}>{fullName(r)}</a>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {r.email} · {formatPhone(r.phone)}
                  </Typography.Text>
                </div>
              </>
            ),
          },
          {
            title: "Специальность, город",
            width: 220,
            render: (_, r) => (
              <>
                {r.specialtyName}
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {[r.city, r.workplace].filter(Boolean).join(", ")}
                  </Typography.Text>
                </div>
              </>
            ),
          },
          {
            title: "Мероприятие",
            width: 230,
            render: (_: unknown, r: Registration) => (
              <>
                {eventId ? (
                  <Typography.Text ellipsis={{ tooltip: r.event.title }}>{r.event.title}</Typography.Text>
                ) : (
                  <Typography.Link ellipsis onClick={() => update({ eventId: r.event.id })} title="Показать заявки только на это мероприятие">
                    {r.event.title}
                  </Typography.Link>
                )}
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(r.event.startDate).format("DD.MM.YYYY")}
                  </Typography.Text>
                </div>
              </>
            ),
          },
          { title: "Формат", dataIndex: "format", width: 110, render: (f: ParticipationFormat) => formatLabels[f] },
          {
            title: "Заявка",
            dataIndex: "createdAt",
            width: 140,
            render: (v: string, r) => (
              <>
                {dateTime.format(new Date(v))}
                {r.source === "MANUAL" && (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      вручную
                    </Typography.Text>
                  </div>
                )}
              </>
            ),
          },
          {
            title: "Статус",
            dataIndex: "status",
            width: 170,
            render: (s: RegistrationStatus, r) => (
              <Select
                size="small"
                value={s}
                variant="borderless"
                onChange={(next: RegistrationStatus) => quickStatus.mutate({ id: r.id, status: next })}
                options={(Object.keys(statusLabels) as RegistrationStatus[]).map((value) => ({
                  value,
                  label: <Tag color={statusColors[value]} style={{ margin: 0 }}>{statusLabels[value]}</Tag>,
                }))}
                style={{ width: 150 }}
                popupMatchSelectWidth={false}
              />
            ),
          },
          {
            title: "",
            width: 60,
            render: (_, r) =>
              r.managerComment ? (
                <MessageOutlined title={r.managerComment} style={{ color: "#8c8c8c" }} />
              ) : null,
          },
        ]}
      />

      <RegistrationDrawer registration={opened} onClose={() => setOpened(null)} />
      <RegistrationSettingsDrawer event={currentEvent} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RegistrationFormModal event={currentEvent} open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
