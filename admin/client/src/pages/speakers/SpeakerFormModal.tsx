import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Col, Form, Input, Modal, Row } from "antd";
import { api } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import type { UploadedImage } from "../../api/uploads";
import { ImageUpload } from "../../components/ImageUpload";
import type { Speaker } from "./speakerTypes";

type Values = {
  lastName: string;
  firstName: string;
  middleName?: string;
  degree?: string;
  position?: string;
  city?: string;
  bio?: string;
  photo: UploadedImage | null;
};

type Props = {
  open: boolean;
  speaker?: Speaker | null;
  onClose: () => void;
  onSaved?: (speaker: Speaker) => void;
};

export function SpeakerFormModal({ open, speaker, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (speaker) {
      form.setFieldsValue({
        ...speaker,
        middleName: speaker.middleName ?? undefined,
        degree: speaker.degree ?? undefined,
        position: speaker.position ?? undefined,
        city: speaker.city ?? undefined,
        bio: speaker.bio ?? undefined,
        photo: speaker.photoUrl && speaker.photoThumbUrl ? { url: speaker.photoUrl, thumbUrl: speaker.photoThumbUrl } : null,
      });
    }
  }, [open, speaker, form]);

  const save = useMutation({
    mutationFn: ({ photo, ...v }: Values) => {
      const body = { ...v, photoUrl: photo?.url ?? null, photoThumbUrl: photo?.thumbUrl ?? null };
      return speaker
        ? api<{ speaker: Speaker }>(`/speakers/${speaker.id}`, { method: "PUT", body })
        : api<{ speaker: Speaker }>("/speakers", { body });
    },
    onSuccess: ({ speaker: saved }) => {
      message.success(speaker ? "Спикер сохранён" : "Спикер добавлен");
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
      queryClient.invalidateQueries({ queryKey: ["program"] });
      queryClient.invalidateQueries({ queryKey: ["event-speakers"] });
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
      title={speaker ? "Изменить спикера" : "Новый спикер"}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      width={640}
      destroyOnHidden
    >
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)} initialValues={{ photo: null }}>
        <Form.Item label="Фото" name="photo" extra="JPG, PNG или WebP до 10 МБ. Миниатюра обрезается по центру лица автоматически.">
          <ImageUpload preset="speaker" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Фамилия" name="lastName" rules={[{ required: true, message: "Введите фамилию" }]}>
              <Input maxLength={60} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Имя" name="firstName" rules={[{ required: true, message: "Введите имя" }]}>
              <Input maxLength={60} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Отчество" name="middleName">
              <Input maxLength={60} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Учёная степень, звание" name="degree">
          <Input maxLength={200} placeholder="д.м.н., профессор" />
        </Form.Item>
        <Form.Item label="Должность и место работы" name="position">
          <Input maxLength={300} placeholder="Заведующий кафедрой кардиологии УГМУ" />
        </Form.Item>
        <Form.Item label="Город" name="city">
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item label="Краткая биография" name="bio" style={{ marginBottom: 0 }}>
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={3000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
