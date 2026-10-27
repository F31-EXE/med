import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { App, Button, Col, Flex, Form, Input, Modal, Radio, Row, Select, Switch, TimePicker, Typography } from "antd";
import { DeleteOutlined, PlusOutlined, UserAddOutlined } from "@ant-design/icons";
import { api, ApiError } from "../../../api/client";
import { applyFieldErrors } from "../../../api/forms";
import { SpeakerFormModal } from "../../speakers/SpeakerFormModal";
import { SpeakerSelect } from "../../speakers/SpeakerSelect";
import type { SpeakerBrief } from "../../speakers/speakerTypes";
import { formatDayLabel, sessionRoleLabels, type Hall, type ProgramDay, type ProgramSession, type SessionSpeakerRole } from "./programTypes";

type Values = {
  dayId: string;
  hallId: string | null;
  kind: "SESSION" | "BREAK";
  time: [Dayjs, Dayjs];
  title: string;
  description?: string | null;
  nmo: boolean;
  speakers: { speakerId?: string; role: SessionSpeakerRole }[];
};

type Props = {
  eventId: string;
  open: boolean;
  session: ProgramSession | null;
  defaults: { dayId: string; hallId: string | null; startTime?: string };
  days: ProgramDay[];
  halls: Hall[];
  onClose: () => void;
  onSaved: () => void;
};

const roleOptions = (Object.keys(sessionRoleLabels) as SessionSpeakerRole[]).map((value) => ({ value, label: sessionRoleLabels[value] }));

function addMinutes(t: string, minutes: number) {
  const d = dayjs(`2000-01-01T${t}`).add(minutes, "minute");
  return d.format("HH:mm");
}

export function SessionFormModal({ eventId, open, session, defaults, days, halls, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [known, setKnown] = useState<SpeakerBrief[]>([]);
  const [creatingSpeaker, setCreatingSpeaker] = useState(false);
  const kind = Form.useWatch("kind", form);
  const speakers = Form.useWatch("speakers", form) ?? [];

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (session) {
      setKnown(session.speakers.map((s) => s.speaker));
      form.setFieldsValue({
        ...session,
        time: [dayjs(`2000-01-01T${session.startTime}`), dayjs(`2000-01-01T${session.endTime}`)],
        speakers: session.speakers.map((s) => ({ speakerId: s.speakerId, role: s.role })),
      });
    } else {
      setKnown([]);
      const start = defaults.startTime ?? "10:00";
      form.setFieldsValue({
        dayId: defaults.dayId,
        hallId: defaults.hallId,
        kind: "SESSION",
        nmo: false,
        speakers: [],
        time: [dayjs(`2000-01-01T${start}`), dayjs(`2000-01-01T${addMinutes(start, 60)}`)],
      });
    }
  }, [open, session, defaults, form]);

  const save = useMutation({
    mutationFn: ({ time, speakers: sp, ...v }: Values) => {
      const body = {
        ...v,
        startTime: time[0].format("HH:mm"),
        endTime: time[1].format("HH:mm"),
        speakers: v.kind === "BREAK" ? [] : sp.filter((s) => s.speakerId),
      };
      const base = `/events/${eventId}/program/sessions`;
      return session ? api(`${base}/${session.id}`, { method: "PUT", body }) : api(base, { body });
    },
    onSuccess: () => {
      message.success(session ? "Сессия сохранена" : "Сессия добавлена");
      onSaved();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        const { startTime, endTime, ...rest } = e.fields;
        applyFieldErrors(form, new ApiError(e.status, e.message, rest));
        if (startTime || endTime) form.setFields([{ name: "time", errors: [startTime || endTime] }]);
      } else {
        message.error(e.message);
      }
    },
  });

  const chosen = speakers.map((s) => s?.speakerId).filter(Boolean) as string[];

  return (
    <Modal
      open={open}
      title={session ? "Изменить сессию" : "Новая сессия"}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      width={720}
      destroyOnHidden
    >
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
        <Form.Item name="kind" style={{ marginBottom: 12 }}>
          <Radio.Group
            optionType="button"
            options={[
              { value: "SESSION", label: "Сессия или доклад" },
              { value: "BREAK", label: "Перерыв" },
            ]}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="День" name="dayId" rules={[{ required: true, message: "Выберите день" }]}>
              <Select options={days.map((d) => ({ value: d.id, label: formatDayLabel(d.date) }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Время" name="time" rules={[{ required: true, message: "Укажите время" }]}>
              <TimePicker.RangePicker
                format="HH:mm"
                minuteStep={5}
                needConfirm={false}
                style={{ width: "100%" }}
                placeholder={["Начало", "Конец"]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Зал" name="hallId">
              <Select
                allowClear
                placeholder={halls.length ? "Все залы" : "Залы не добавлены"}
                options={halls.map((h) => ({ value: h.id, label: h.name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Название" name="title" rules={[{ required: true, message: "Введите название" }]}>
          <Input maxLength={300} placeholder={kind === "BREAK" ? "Кофе-брейк" : "Пленарное заседание"} />
        </Form.Item>
        {kind !== "BREAK" && (
          <>
            <Form.Item label="Описание" name="description">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} maxLength={5000} />
            </Form.Item>
            <Form.Item name="nmo" valuePropName="checked" style={{ marginBottom: 16 }}>
              <Switch checkedChildren="НМО" unCheckedChildren="НМО" />
            </Form.Item>
            <Typography.Text strong>Модераторы и докладчики</Typography.Text>
            <Form.List name="speakers">
              {(fields, { add, remove }) => (
                <div style={{ marginTop: 8 }}>
                  {fields.map((field) => (
                    <Flex key={field.key} gap={8} align="flex-start" wrap>
                      <Form.Item
                        name={[field.name, "speakerId"]}
                        rules={[{ required: true, message: "Выберите спикера" }]}
                        style={{ flex: "1 1 260px", minWidth: 0 }}
                      >
                        <SpeakerSelect
                          known={known}
                          exclude={chosen}
                          onChange={(_id, s) => setKnown((k) => [...k.filter((x) => x.id !== s.id), s])}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, "role"]} style={{ width: 150 }}>
                        <Select options={roleOptions} />
                      </Form.Item>
                      <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="Убрать спикера" />
                    </Flex>
                  ))}
                  <Flex gap={8} wrap>
                    <Button icon={<PlusOutlined />} onClick={() => add({ role: fields.length ? "SPEAKER" : "MODERATOR" })}>
                      Добавить из справочника
                    </Button>
                    <Button icon={<UserAddOutlined />} onClick={() => setCreatingSpeaker(true)}>
                      Новый спикер
                    </Button>
                  </Flex>
                </div>
              )}
            </Form.List>
          </>
        )}
      </Form>
      <SpeakerFormModal
        open={creatingSpeaker}
        onClose={() => setCreatingSpeaker(false)}
        onSaved={(s) => {
          setKnown((k) => [...k, s]);
          const list = form.getFieldValue("speakers") ?? [];
          form.setFieldValue("speakers", [...list, { speakerId: s.id, role: list.length ? "SPEAKER" : "MODERATOR" }]);
        }}
      />
    </Modal>
  );
}
