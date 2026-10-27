import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "../../../api/client";
import { applyFieldErrors } from "../../../api/forms";
import { SortableList } from "../../../components/SortableList";
import { EventShell } from "../EventTabs";
import { SessionFormModal } from "./SessionFormModal";
import { formatDayLabel, sessionRoleLabels, type Hall, type Program, type ProgramDay, type ProgramSession } from "./programTypes";

function HallsCard({ eventId, halls, readOnly }: { eventId: string; halls: Hall[]; readOnly: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const key = ["program", eventId];
  const base = `/events/${eventId}/program/halls`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const onError = (e: Error) => {
    message.error(e.message);
    refresh();
  };

  const add = useMutation({
    mutationFn: (name: string) => api(base, { body: { name } }),
    onSuccess: () => {
      form.resetFields();
      refresh();
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
    },
  });
  const rename = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api(`${base}/${id}`, { method: "PATCH", body: { name } }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => api(`${base}/${id}`, { method: "DELETE" }), onSuccess: refresh, onError });
  const reorder = useMutation({ mutationFn: (ids: string[]) => api(`${base}/order`, { method: "PUT", body: { ids } }), onError });

  return (
    <Card title="Залы" size="small" style={{ marginBottom: 16 }}>
      {halls.length === 0 && (
        <Typography.Paragraph type="secondary">Если мероприятие идёт в одном зале, залы можно не добавлять.</Typography.Paragraph>
      )}
      <SortableList
        items={halls}
        getId={(h) => h.id}
        disabled={readOnly}
        onReorder={(next) => {
          queryClient.setQueryData<Program>(key, (p) => (p ? { ...p, halls: next } : p));
          reorder.mutate(next.map((h) => h.id));
        }}
        renderItem={(h, handle) => (
          <Flex align="center" gap={8} style={{ padding: "4px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
            {handle}
            <Typography.Text
              style={{ flex: 1 }}
              editable={readOnly ? false : { onChange: (name) => name.trim() && name !== h.name && rename.mutate({ id: h.id, name: name.trim() }), maxLength: 100, tooltip: "Переименовать" }}
            >
              {h.name}
            </Typography.Text>
            {!readOnly && (
              <Popconfirm
                title="Удалить зал?"
                description="Сессии этого зала останутся в программе без зала."
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={() => remove.mutateAsync(h.id)}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Удалить зал" />
              </Popconfirm>
            )}
          </Flex>
        )}
      />
      {!readOnly && (
        <Form form={form} layout="inline" onFinish={({ name }) => add.mutate(name)} style={{ marginTop: 12, rowGap: 8 }}>
          <Form.Item name="name" rules={[{ required: true, message: "Введите название" }]} style={{ flex: "1 1 200px" }}>
            <Input placeholder="Например, Большой зал" maxLength={100} />
          </Form.Item>
          <Button htmlType="submit" icon={<PlusOutlined />} loading={add.isPending}>
            Добавить зал
          </Button>
        </Form>
      )}
    </Card>
  );
}

function AddDayModal({ eventId, program, open, onClose, onAdded }: { eventId: string; program: Program; open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ date: Dayjs; title?: string }>();
  const taken = new Set(program.days.map((d) => d.date));
  const add = useMutation({
    mutationFn: (v: { date: Dayjs; title?: string }) =>
      api<{ day: ProgramDay }>(`/events/${eventId}/program/days`, { body: { date: v.date.format("YYYY-MM-DD"), title: v.title } }),
    onSuccess: ({ day }) => {
      onAdded(day.id);
      onClose();
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
    },
  });
  const firstFree = (() => {
    for (let d = dayjs(program.event.startDate); !d.isAfter(program.event.endDate); d = d.add(1, "day")) {
      if (!taken.has(d.format("YYYY-MM-DD"))) return d;
    }
    return undefined;
  })();

  return (
    <Modal open={open} title="Добавить день" okText="Добавить" cancelText="Отмена" onOk={() => form.submit()} onCancel={onClose} confirmLoading={add.isPending} destroyOnHidden afterOpenChange={(o) => o && form.setFieldsValue({ date: firstFree, title: undefined })}>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => add.mutate(v)}>
        <Form.Item label="Дата" name="date" rules={[{ required: true, message: "Выберите дату" }]}>
          <DatePicker
            format="DD.MM.YYYY"
            style={{ width: "100%" }}
            disabledDate={(d) => d.isBefore(program.event.startDate, "day") || d.isAfter(program.event.endDate, "day") || taken.has(d.format("YYYY-MM-DD"))}
          />
        </Form.Item>
        <Form.Item label="Подпись дня" name="title" extra="Необязательно, например «Школа для ординаторов»" style={{ marginBottom: 0 }}>
          <Input maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function SessionCard({ s, hall, handle, readOnly, onEdit, onDelete }: { s: ProgramSession; hall?: Hall; handle: ReactNode; readOnly: boolean; onEdit: () => void; onDelete: () => Promise<unknown> }) {
  const isBreak = s.kind === "BREAK";
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "10px 8px",
        marginBottom: 8,
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        background: isBreak ? "#FAFAFA" : "#fff",
      }}
    >
      {handle}
      <div style={{ width: 120, flexShrink: 0, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", paddingTop: 2 }}>
        <ClockCircleOutlined style={{ color: "#8c8c8c", marginRight: 4 }} />
        {s.startTime}–{s.endTime}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={4} wrap style={{ marginBottom: 2 }}>
          {hall && <Tag>{hall.name}</Tag>}
          {s.nmo && <Tag color="blue">НМО</Tag>}
          {isBreak && <Tag>Перерыв</Tag>}
        </Space>
        <div>
          <Typography.Text strong={!isBreak} type={isBreak ? "secondary" : undefined}>
            {s.title}
          </Typography.Text>
        </div>
        {s.speakers.length > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {s.speakers.map((sp) => `${sp.speaker.fullName}${sp.role === "MODERATOR" ? ` (${sessionRoleLabels.MODERATOR.toLowerCase()})` : ""}`).join(", ")}
          </Typography.Text>
        )}
      </div>
      {!readOnly && (
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} aria-label="Изменить сессию" />
          <Popconfirm title="Удалить сессию?" okText="Удалить" cancelText="Отмена" onConfirm={onDelete}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Удалить сессию" />
          </Popconfirm>
        </Space>
      )}
    </div>
  );
}

function DayPanel({ eventId, program, day, readOnly, onEditSession, onAddSession }: { eventId: string; program: Program; day: ProgramDay; readOnly: boolean; onEditSession: (s: ProgramSession) => void; onAddSession: (hallId: string | null, startTime?: string) => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [hallFilter, setHallFilter] = useState<string>("all");
  const key = ["program", eventId];
  const base = `/events/${eventId}/program`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const onError = (e: Error) => {
    message.error(e.message);
    refresh();
  };

  const reorder = useMutation({ mutationFn: (ids: string[]) => api(`${base}/days/${day.id}/order`, { method: "PUT", body: { ids } }), onError });
  const sortByTime = useMutation({ mutationFn: () => api(`${base}/days/${day.id}/sort-by-time`, { method: "POST" }), onSuccess: refresh, onError });
  const removeSession = useMutation({ mutationFn: (id: string) => api(`${base}/sessions/${id}`, { method: "DELETE" }), onSuccess: refresh, onError });
  const updateDay = useMutation({ mutationFn: (title: string) => api(`${base}/days/${day.id}`, { method: "PATCH", body: { title } }), onSuccess: refresh, onError });
  const removeDay = useMutation({ mutationFn: () => api(`${base}/days/${day.id}`, { method: "DELETE" }), onSuccess: refresh, onError });

  const hallsById = new Map(program.halls.map((h) => [h.id, h]));
  const visible = hallFilter === "all" ? day.sessions : day.sessions.filter((s) => (hallFilter === "none" ? !s.hallId : s.hallId === hallFilter || !s.hallId));
  const nmoCount = day.sessions.filter((s) => s.nmo).length;

  function applyOrder(nextVisible: ProgramSession[]) {
    const visibleIds = new Set(nextVisible.map((s) => s.id));
    const queue = [...nextVisible];
    const full = day.sessions.map((s) => (visibleIds.has(s.id) ? queue.shift()! : s));
    queryClient.setQueryData<Program>(key, (p) =>
      p ? { ...p, days: p.days.map((d) => (d.id === day.id ? { ...d, sessions: full } : d)) } : p,
    );
    reorder.mutate(full.map((s) => s.id));
  }

  const last = day.sessions.reduce<string | undefined>((acc, s) => (!acc || s.endTime > acc ? s.endTime : acc), undefined);

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <Typography.Text
          type={day.title ? undefined : "secondary"}
          editable={readOnly ? false : { onChange: (t) => t !== (day.title ?? "") && updateDay.mutate(t), maxLength: 200, tooltip: "Подпись дня", text: day.title ?? "" }}
        >
          {day.title || "Без подписи"}
        </Typography.Text>
        {!readOnly && (
          <Space wrap>
            <Button onClick={() => sortByTime.mutate()} loading={sortByTime.isPending} disabled={day.sessions.length < 2}>
              Упорядочить по времени
            </Button>
            <Popconfirm
              title="Удалить день?"
              description={day.sessions.length ? `Вместе с ним удалятся сессии: ${day.sessions.length}.` : undefined}
              okText="Удалить"
              cancelText="Отмена"
              onConfirm={() => removeDay.mutateAsync()}
            >
              <Button danger>Удалить день</Button>
            </Popconfirm>
          </Space>
        )}
      </Flex>

      {program.halls.length > 0 && (
        <Segmented
          value={hallFilter}
          onChange={setHallFilter}
          options={[{ value: "all", label: "Все залы" }, ...program.halls.map((h) => ({ value: h.id, label: h.name })), { value: "none", label: "Без зала" }]}
          style={{ marginBottom: 12, maxWidth: "100%", overflowX: "auto" }}
        />
      )}

      {day.sessions.length > 0 && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          Сессий: {day.sessions.length}, с отметкой НМО: {nmoCount}. Порядок меняется перетаскиванием за значок слева.
          {hallFilter !== "all" && hallFilter !== "none" && " Сессии без зала показаны во всех залах."}
        </Typography.Paragraph>
      )}

      {visible.length === 0 ? (
        <Empty description="Сессий пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <SortableList
          items={visible}
          getId={(s) => s.id}
          disabled={readOnly}
          onReorder={applyOrder}
          renderItem={(s, handle) => (
            <SessionCard
              s={s}
              hall={s.hallId ? hallsById.get(s.hallId) : undefined}
              handle={handle}
              readOnly={readOnly}
              onEdit={() => onEditSession(s)}
              onDelete={() => removeSession.mutateAsync(s.id)}
            />
          )}
        />
      )}

      {!readOnly && (
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={() => onAddSession(hallFilter === "all" || hallFilter === "none" ? null : hallFilter, last)}
          style={{ marginTop: 8 }}
        >
          Добавить сессию
        </Button>
      )}
    </>
  );
}

export function ProgramPage() {
  const { id } = useParams();
  return <EventShell id={id!} active="program">{(event) => <ProgramEditor eventId={id!} readOnly={event.state === "deleted"} />}</EventShell>;
}

function ProgramEditor({ eventId, readOnly }: { eventId: string; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const program = useQuery({
    queryKey: ["program", eventId],
    queryFn: () => api<Program>(`/events/${eventId}/program`),
  });
  const [activeDay, setActiveDay] = useState<string>();
  const [addingDay, setAddingDay] = useState(false);
  const [sessionModal, setSessionModal] = useState<{ session: ProgramSession | null; defaults: { dayId: string; hallId: string | null; startTime?: string } } | null>(null);

  const days = program.data?.days ?? [];
  const current = useMemo(() => days.find((d) => d.id === activeDay) ?? days[0], [days, activeDay]);

  if (program.isPending) {
    return (
      <Flex justify="center" style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }
  if (program.isError) return <Typography.Text type="danger">{program.error.message}</Typography.Text>;
  const data = program.data;

  return (
    <>
      <HallsCard eventId={eventId} halls={data.halls} readOnly={readOnly} />

      <Card size="small" title="Программа по дням">
        {days.length === 0 ? (
          <Empty description="Дни программы ещё не добавлены">
            {!readOnly && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddingDay(true)}>
                Добавить день
              </Button>
            )}
          </Empty>
        ) : (
          <Tabs
            activeKey={current?.id}
            onChange={setActiveDay}
            tabBarExtraContent={
              !readOnly && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingDay(true)}>
                  День
                </Button>
              )
            }
            items={days.map((d) => ({
              key: d.id,
              label: formatDayLabel(d.date),
              children: (
                <DayPanel
                  eventId={eventId}
                  program={data}
                  day={d}
                  readOnly={readOnly}
                  onEditSession={(s) => setSessionModal({ session: s, defaults: { dayId: s.dayId, hallId: s.hallId } })}
                  onAddSession={(hallId, startTime) => setSessionModal({ session: null, defaults: { dayId: d.id, hallId, startTime } })}
                />
              ),
            }))}
          />
        )}
      </Card>

      <AddDayModal
        eventId={eventId}
        program={data}
        open={addingDay}
        onClose={() => setAddingDay(false)}
        onAdded={(dayId) => {
          setActiveDay(dayId);
          queryClient.invalidateQueries({ queryKey: ["program", eventId] });
        }}
      />
      <SessionFormModal
        eventId={eventId}
        open={sessionModal !== null}
        session={sessionModal?.session ?? null}
        defaults={sessionModal?.defaults ?? { dayId: current?.id ?? "", hallId: null }}
        days={days}
        halls={data.halls}
        onClose={() => setSessionModal(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["program", eventId] })}
      />
    </>
  );
}
