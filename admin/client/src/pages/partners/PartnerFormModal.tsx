import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Checkbox, Form, Input, Modal } from "antd";
import { api } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import type { UploadedImage } from "../../api/uploads";
import { ImageUpload } from "../../components/ImageUpload";
import type { Partner } from "./partnerTypes";

type Values = { name: string; url?: string | null; description?: string | null; logo: UploadedImage | null; showOnHome: boolean };

type Props = { open: boolean; partner: Partner | null; onClose: () => void; onSaved?: (p: Partner) => void };

export function PartnerFormModal({ open, partner, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      partner
        ? {
            name: partner.name,
            url: partner.url,
            description: partner.description,
            showOnHome: partner.showOnHome,
            logo: partner.logoUrl && partner.logoThumbUrl ? { url: partner.logoUrl, thumbUrl: partner.logoThumbUrl } : null,
          }
        : { logo: null, showOnHome: false },
    );
  }, [open, partner, form]);

  const save = useMutation({
    mutationFn: ({ logo, ...v }: Values) => {
      const body = { ...v, logoUrl: logo?.url ?? null, logoThumbUrl: logo?.thumbUrl ?? null };
      return partner
        ? api<{ partner: Partner }>(`/partners/${partner.id}`, { method: "PUT", body })
        : api<{ partner: Partner }>("/partners", { body });
    },
    onSuccess: ({ partner: saved }) => {
      message.success(partner ? "Партнёр сохранён" : "Партнёр добавлен");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["event-partners"] });
      onSaved?.(saved);
      onClose();
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
    },
  });

  return (
    <Modal
      open={open}
      title={partner ? "Изменить партнёра" : "Новый партнёр"}
      okText="Сохранить"
      cancelText="Отмена"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={save.isPending}
      width={560}
      destroyOnHidden
    >
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
        <Form.Item label="Логотип" name="logo" extra="SVG или PNG с прозрачным фоном, также JPG и WebP до 10 МБ. Логотип не обрезается.">
          <ImageUpload preset="logo" accept="image/svg+xml,image/png,image/jpeg,image/webp" />
        </Form.Item>
        <Form.Item label="Название" name="name" rules={[{ required: true, message: "Введите название" }]}>
          <Input maxLength={200} placeholder="ООО «ФармаЛаб»" />
        </Form.Item>
        <Form.Item label="Сайт" name="url" extra="Логотип на сайте будет ссылкой на этот адрес">
          <Input maxLength={500} placeholder="pharmalab.ru" inputMode="url" />
        </Form.Item>
        <Form.Item label="Описание" name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} />
        </Form.Item>
        <Form.Item name="showOnHome" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Показывать в ленте партнёров на главной</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
