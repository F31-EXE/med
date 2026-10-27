import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Descriptions, Drawer, Input, Popconfirm, Segmented, Space, Tag, Typography } from "antd";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import {
  dateTime,
  formatLabels,
  formatPhone,
  fullName,
  statusLabels,
  type Registration,
  type RegistrationStatus,
} from "./registrationTypes";

export function RegistrationDrawer({ registration, onClose }: { registration: Registration | null; onClose: () => void }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  useEffect(() => setComment(registration?.managerComment ?? ""), [registration]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["registrations"] });
    queryClient.invalidateQueries({ queryKey: ["registration-events"] });
  };

  const update = useMutation({
    mutationFn: (body: { status?: RegistrationStatus; managerComment?: string }) =>
      api(`/registrations/${registration!.id}`, { method: "PATCH", body }),
    onSuccess: (_d, body) => {
      message.success(body.status ? `Статус: ${statusLabels[body.status].toLowerCase()}` : "Комментарий сохранён");
      refresh();
      if (body.status) onClose();
    },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/registrations/${registration!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      message.success("Заявка удалена");
      refresh();
      onClose();
    },
    onError: (e) => message.error(e.message),
  });

  const r = registration;

  return (
    <Drawer open={!!r} onClose={onClose} title={r ? fullName(r) : ""} size={520} destroyOnHidden>
      {r && (
        <>
          <Typography.Text type="secondary">Статус заявки</Typography.Text>
          <div style={{ margin: "6px 0 20px" }}>
            <Segmented<RegistrationStatus>
              value={r.status}
              disabled={update.isPending}
              onChange={(status) => update.mutate({ status })}
              options={(Object.keys(statusLabels) as RegistrationStatus[]).map((value) => ({ value, label: statusLabels[value] }))}
            />
          </div>
          <Descriptions column={1} size="small" bordered styles={{ label: { width: 170 } }}>
            <Descriptions.Item label="Мероприятие">{r.event.title}</Descriptions.Item>
            <Descriptions.Item label="E-mail">
              <a href={`mailto:${r.email}`}>{r.email}</a>
            </Descriptions.Item>
            <Descriptions.Item label="Телефон">
              <a href={`tel:${r.phone}`}>{formatPhone(r.phone)}</a>
            </Descriptions.Item>
            <Descriptions.Item label="Специальность">{r.specialtyName}</Descriptions.Item>
            {r.workplace && <Descriptions.Item label="Место работы">{r.workplace}</Descriptions.Item>}
            {r.position && <Descriptions.Item label="Должность">{r.position}</Descriptions.Item>}
            <Descriptions.Item label="Город">{r.city}</Descriptions.Item>
            <Descriptions.Item label="Формат участия">{formatLabels[r.format]}</Descriptions.Item>
            {r.snils && <Descriptions.Item label="СНИЛС">{r.snils}</Descriptions.Item>}
            <Descriptions.Item label="Заявка">
              {dateTime.format(new Date(r.createdAt))} <Tag style={{ marginInlineStart: 8 }}>{r.source === "SITE" ? "с сайта" : "вручную"}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Согласие на ПДн">{dateTime.format(new Date(r.consentAt))}</Descriptions.Item>
            <Descriptions.Item label="Рассылка">{r.consentMailing ? "согласен" : "нет"}</Descriptions.Item>
            {r.statusChangedAt && <Descriptions.Item label="Статус изменён">{dateTime.format(new Date(r.statusChangedAt))}</Descriptions.Item>}
          </Descriptions>

          <Typography.Text strong style={{ display: "block", margin: "20px 0 6px" }}>
            Комментарий менеджера
          </Typography.Text>
          <Input.TextArea value={comment} onChange={(e) => setComment(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} maxLength={2000} />
          <Space style={{ marginTop: 8 }} wrap>
            <Button onClick={() => update.mutate({ managerComment: comment })} disabled={comment === (r.managerComment ?? "")} loading={update.isPending}>
              Сохранить комментарий
            </Button>
            {user?.role === "ADMIN" && (
              <Popconfirm
                title="Удалить заявку навсегда?"
                description="Используйте только по запросу участника на удаление данных. Обычно заявку отклоняют."
                okText="Удалить"
                okButtonProps={{ danger: true }}
                cancelText="Отмена"
                onConfirm={() => remove.mutateAsync()}
              >
                <Button danger type="text">
                  Удалить данные
                </Button>
              </Popconfirm>
            )}
          </Space>
        </>
      )}
    </Drawer>
  );
}
