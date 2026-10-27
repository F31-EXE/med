import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { Alert, App, Button, Checkbox, DatePicker, Drawer, Form, Input, InputNumber, Space, Switch, Typography } from "antd";
import { api } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import {
  fieldLabels,
  formatLabels,
  type ParticipationFormat,
  type RegistrationEvent,
  type RegistrationFields,
  type RegistrationSettings,
} from "./registrationTypes";

type Values = Omit<RegistrationSettings, "registrationDeadline"> & { registrationDeadline: Dayjs | null };

export function RegistrationSettingsDrawer({ event, open, onClose }: { event: RegistrationEvent | null; open: boolean; onClose: () => void }) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (open && event) {
      form.setFieldsValue({
        ...event.settings,
        registrationDeadline: event.settings.registrationDeadline ? dayjs(event.settings.registrationDeadline) : null,
      });
    }
  }, [open, event, form]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      api<{ event: RegistrationEvent; warning: string | null }>(`/registrations/events/${event!.id}/settings`, {
        method: "PUT",
        body: { ...v, registrationDeadline: v.registrationDeadline ? v.registrationDeadline.toISOString() : null },
      }),
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: ["registration-events"] });
      queryClient.invalidateQueries({ queryKey: ["event", event!.id] });
      if (warning) modal.warning({ title: "Настройки сохранены", content: warning });
      else message.success("Настройки регистрации сохранены");
      onClose();
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
    },
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Настройки регистрации"
      size={520}
      destroyOnHidden
      extra={
        <Button type="primary" onClick={() => form.submit()} loading={save.isPending}>
          Сохранить
        </Button>
      }
    >
      {event && (
        <>
          <Typography.Paragraph type="secondary">{event.title}</Typography.Paragraph>
          {event.nmoPoints ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={`Мероприятие даёт ${event.nmoPoints} баллов НМО. Если для отчёта нужен СНИЛС, включите поле ниже.`}
            />
          ) : null}
          <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
            <Form.Item label="Регистрация открыта" name="registrationEnabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="Закрыть регистрацию" name="registrationDeadline" extra="Пусто — до дня начала мероприятия">
              <DatePicker showTime={{ format: "HH:mm" }} format="DD.MM.YYYY HH:mm" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="Лимит мест"
              name="maxParticipants"
              extra={`Пусто — без ограничения. Сейчас занято: ${event.availability.taken} (новые и подтверждённые заявки; отклонённые место не занимают).`}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="showRegistrationCount" valuePropName="checked">
              <Checkbox>Показывать на сайте счётчик регистраций</Checkbox>
            </Form.Item>
            <Form.Item label="Форматы участия в форме" name="registrationFormats" rules={[{ required: true, message: "Выберите хотя бы один формат" }]}>
              <Checkbox.Group
                options={(Object.keys(formatLabels) as ParticipationFormat[]).map((value) => ({ value, label: formatLabels[value] }))}
              />
            </Form.Item>
            <Typography.Text strong>Необязательные поля формы</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
              ФИО, e-mail, телефон, специальность, город, формат и согласие на обработку ПДн есть в форме всегда.
            </Typography.Paragraph>
            <Space direction="vertical" style={{ marginBottom: 16 }}>
              {(Object.keys(fieldLabels) as (keyof RegistrationFields)[]).map((key) => (
                <Form.Item key={key} name={["registrationFields", key]} valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox>{fieldLabels[key]}</Checkbox>
                </Form.Item>
              ))}
            </Space>
            <Form.Item
              label="Текст письма-подтверждения"
              name="confirmationText"
              extra="Добавляется в письмо участнику после названия, дат, площадки, формата участия и контактов организатора."
            >
              <Input.TextArea autoSize={{ minRows: 4, maxRows: 12 }} maxLength={5000} showCount />
            </Form.Item>
          </Form>
        </>
      )}
    </Drawer>
  );
}
