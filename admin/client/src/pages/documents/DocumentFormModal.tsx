import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Form, Input, Modal, Select, Typography, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import { EventSelect } from "../../components/EventSelect";
import { sendDocument, useSvedenSections } from "./documentsApi";
import { ACCEPT, MAX_SIZE, formatSize, type DocumentItem } from "./documentTypes";

type Values = { title?: string; description?: string | null; eventId: string | null; svedenSection: string | null };

type Props = {
  open: boolean;
  document: DocumentItem | null;
  defaults?: { eventId?: string | null; svedenSection?: string | null; eventSection?: "MAIN" | "RESULTS" };
  onClose: () => void;
};

export function DocumentFormModal({ open, document, defaults, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<Values>();
  const [file, setFile] = useState<File | null>(null);
  const sections = useSvedenSections();
  const isNew = !document;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setFile(null);
    form.setFieldsValue(
      document
        ? { title: document.title, description: document.description, eventId: document.eventId, svedenSection: document.svedenSection }
        : { eventId: defaults?.eventId ?? null, svedenSection: defaults?.svedenSection ?? null },
    );
  }, [open, document, defaults, form]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      if (isNew) {
        if (!file) throw new Error("Выберите файл");
        return sendDocument("/documents", file, {
          title: v.title,
          description: v.description,
          eventId: v.eventId,
          svedenSection: v.svedenSection,
          eventSection: v.eventId ? (defaults?.eventSection ?? "MAIN") : undefined,
        });
      }
      return api<{ document: DocumentItem }>(`/documents/${document.id}`, { method: "PUT", body: v }).then((r) => r.document);
    },
    onSuccess: () => {
      message.success(isNew ? "Документ загружен" : "Документ сохранён");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
    },
  });

  return (
    <Modal
      open={open}
      title={isNew ? "Загрузить документ" : "Изменить документ"}
      okText={isNew ? "Загрузить" : "Сохранить"}
      cancelText="Отмена"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={save.isPending}
      okButtonProps={{ disabled: isNew && !file }}
      width={600}
      destroyOnHidden
    >
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
        {isNew && (
          <Form.Item label="Файл" required>
            <Upload.Dragger
              accept={ACCEPT}
              maxCount={1}
              showUploadList={false}
              beforeUpload={(f) => {
                if (f.size > MAX_SIZE) {
                  message.error("Файл больше 20 МБ");
                  return Upload.LIST_IGNORE;
                }
                setFile(f);
                if (!form.getFieldValue("title")) form.setFieldValue("title", f.name.replace(/\.[^.]+$/, "").replace(/_+/g, " "));
                return false;
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              {file ? (
                <p className="ant-upload-text">
                  {file.name} · {formatSize(file.size)}
                </p>
              ) : (
                <>
                  <p className="ant-upload-text">Перетащите файл сюда или нажмите, чтобы выбрать</p>
                  <p className="ant-upload-hint">PDF, DOC, DOCX, XLS или XLSX до 20 МБ</p>
                </>
              )}
            </Upload.Dragger>
          </Form.Item>
        )}
        <Form.Item label="Название на сайте" name="title" rules={[{ required: !isNew, message: "Введите название" }]} extra={isNew ? "Если пусто — из имени файла" : undefined}>
          <Input maxLength={200} placeholder="Например, Программа конгресса" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} />
        </Form.Item>
        <Typography.Text strong>Где показывать</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
          Можно выбрать и мероприятие, и подраздел, или ни то ни другое — тогда документ доступен только по ссылке.
        </Typography.Paragraph>
        <Form.Item label="Страница мероприятия" name="eventId">
          <EventSelect />
        </Form.Item>
        <Form.Item label="Сведения об образовательной организации" name="svedenSection" style={{ marginBottom: 0 }}>
          <Select allowClear placeholder="Не размещать" options={sections.data?.map((s) => ({ value: s.key, label: s.title }))} loading={sections.isPending} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
