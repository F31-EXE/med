import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Flex, Form, Input, Space, Spin, Typography } from "antd";
import { DeleteOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import { GalleryEditor, type GalleryImage } from "../../components/GalleryEditor";
import { DocumentFormModal } from "../documents/DocumentFormModal";
import { DocumentList } from "../documents/DocumentList";
import type { DocumentItem } from "../documents/documentTypes";
import { EventShell } from "./EventTabs";

type Results = {
  resultsText: string | null;
  resultsFacts: { value: string; label: string }[];
  resultsLinks: { title: string; url: string }[];
  images: GalleryImage[];
  isPast: boolean;
};

type Values = Omit<Results, "isPast">;

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <Card title={title} extra={extra} style={{ marginBottom: 16 }}>
      {children}
    </Card>
  );
}

export function EventResultsPage() {
  const { id } = useParams();
  return <EventShell id={id!} active="results">{(event) => <EventResults eventId={id!} readOnly={event.state === "deleted"} />}</EventShell>;
}

function EventResults({ eventId, readOnly }: { eventId: string; readOnly: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<Values>();
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ["event-results", eventId],
    queryFn: () => api<{ results: Results }>(`/events/${eventId}/results`).then((r) => r.results),
  });

  const materials = useQuery({
    queryKey: ["documents", "list", `eventId=${eventId}&eventSection=RESULTS`],
    queryFn: () => api<{ items: DocumentItem[] }>(`/documents?eventId=${eventId}&eventSection=RESULTS`),
  });
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);

  useEffect(() => {
    if (query.data) {
      const { isPast: _p, ...values } = query.data;
      form.setFieldsValue(values);
    }
  }, [query.data, form]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      api<{ results: Results }>(`/events/${eventId}/results`, {
        method: "PUT",
        body: { ...v, images: (v.images ?? []).map(({ url, thumbUrl, caption }) => ({ url, thumbUrl, caption })) },
      }).then((r) => r.results),
    onSuccess: (saved) => {
      message.success("Итоги сохранены");
      queryClient.setQueryData(["event-results", eventId], saved);
    },
    onError: (e) => {
      applyFieldErrors(form, e);
      message.error(e.message);
    },
  });

  if (query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }
  if (query.isError) return <Typography.Text type="danger">{query.error.message}</Typography.Text>;

  return (
    <>
      {query.data.isPast ? (
        <Typography.Paragraph type="secondary">
          Мероприятие прошло: на его странице вместо регистрации показываются итоги — текст, цифры, фотогалерея и материалы докладов.
        </Typography.Paragraph>
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Итоги появятся на сайте после окончания мероприятия"
          description="Заполнять их можно заранее — до этого на странице показывается регистрация."
        />
      )}

      <Form<Values> form={form} layout="vertical" requiredMark={false} disabled={readOnly || save.isPending} onFinish={(v) => save.mutate(v)}>
        <Section title="Итоги">
          <Form.Item label="Текст" name="resultsText" extra="Абзацы разделяйте пустой строкой">
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 20 }} maxLength={20000} showCount />
          </Form.Item>
          <Typography.Text strong>Цифры</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
            Например: «1200 — участников», «48 — докладов», «18 — баллов НМО».
          </Typography.Paragraph>
          <Form.List name="resultsFacts">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Flex key={f.key} gap={8} align="flex-start">
                    <Form.Item name={[f.name, "value"]} rules={[{ required: true, message: "Цифра" }]} style={{ width: 120 }}>
                      <Input placeholder="1200" maxLength={30} />
                    </Form.Item>
                    <Form.Item name={[f.name, "label"]} rules={[{ required: true, message: "Подпись" }]} style={{ flex: 1 }}>
                      <Input placeholder="участников" maxLength={100} />
                    </Form.Item>
                    <Button icon={<DeleteOutlined />} onClick={() => remove(f.name)} aria-label="Удалить цифру" />
                  </Flex>
                ))}
                {fields.length < 8 && (
                  <Button icon={<PlusOutlined />} onClick={() => add({ value: "", label: "" })}>
                    Добавить цифру
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Section>

        <Section title="Фотогалерея">
          <Form.Item name="images" style={{ marginBottom: 0 }}>
            <GalleryEditor max={100} />
          </Form.Item>
        </Section>

        <Section title="Видео и ссылки">
          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
            Записи трансляций, альбомы, публикации по итогам.
          </Typography.Paragraph>
          <Form.List name="resultsLinks">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Flex key={f.key} gap={8} align="flex-start" wrap>
                    <Form.Item name={[f.name, "title"]} rules={[{ required: true, message: "Название" }]} style={{ flex: "1 1 240px" }}>
                      <Input placeholder="Запись пленарного заседания" maxLength={200} />
                    </Form.Item>
                    <Form.Item name={[f.name, "url"]} rules={[{ required: true, message: "Ссылка" }]} style={{ flex: "1 1 240px" }}>
                      <Input placeholder="rutube.ru/video/…" maxLength={500} inputMode="url" />
                    </Form.Item>
                    <Button icon={<DeleteOutlined />} onClick={() => remove(f.name)} aria-label="Удалить ссылку" />
                  </Flex>
                ))}
                {fields.length < 30 && (
                  <Button icon={<PlusOutlined />} onClick={() => add({ title: "", url: "" })}>
                    Добавить ссылку
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Section>
      </Form>

      <Section
        title="Материалы докладов"
        extra={
          !readOnly && (
            <Button size="small" icon={<UploadOutlined />} onClick={() => setUploading(true)}>
              Загрузить
            </Button>
          )
        }
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          Презентации и тезисы в PDF, DOC(X), XLS(X) до 20 МБ. Сохраняются сразу, отдельно от кнопки «Сохранить итоги»; порядок — перетаскиванием.
        </Typography.Paragraph>
        {materials.isPending ? (
          <Spin />
        ) : materials.isError ? (
          <Typography.Text type="danger">{materials.error.message}</Typography.Text>
        ) : (
          <DocumentList
            items={materials.data.items}
            sortScope={{ scope: "event", key: eventId, eventSection: "RESULTS" }}
            showPlacement={false}
            readOnly={readOnly}
            onEdit={setEditingDoc}
          />
        )}
      </Section>

      {!readOnly && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#fff", borderTop: "1px solid #f0f0f0", padding: "12px 16px", margin: "0 -16px" }}>
          <Space wrap>
            <Button type="primary" onClick={() => form.submit()} loading={save.isPending}>
              Сохранить итоги
            </Button>
          </Space>
        </div>
      )}

      <DocumentFormModal
        open={uploading || editingDoc !== null}
        document={editingDoc}
        defaults={{ eventId, eventSection: "RESULTS" }}
        onClose={() => {
          setUploading(false);
          setEditingDoc(null);
        }}
      />
    </>
  );
}
