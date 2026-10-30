import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Checkbox, Col, Form, Input, Modal, Row, Select } from "antd";
import { api } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import { dictionaryOptions, useDictionary } from "../../api/dictionaries";
import { formatLabels, type RegistrationEvent } from "./registrationTypes";

export function RegistrationFormModal({ event, open, onClose }: { event: RegistrationEvent | null; open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const specialties = useDictionary("specialties");
  const fields = event?.settings.registrationFields;

  useEffect(() => {
    if (open && event) {
      form.resetFields();
      form.setFieldsValue({ format: event.settings.registrationFormats[0], consentPersonalData: false, consentMailing: false });
    }
  }, [open, event, form]);

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => api("/registrations", { body: { ...v, eventId: event!.id } }),
    onSuccess: () => {
      message.success("Заявка добавлена");
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registration-events"] });
      onClose();
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
    },
  });

  return (
    <Modal
      open={open}
      title="Новая заявка"
      okText="Добавить"
      cancelText="Отмена"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={save.isPending}
      width={680}
      destroyOnHidden
    >
      {event && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title={`${event.title}. Заявка из админки добавляется даже при закрытой регистрации и превышении лимита; дубли по e-mail не допускаются.`}
          />
          <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
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
              {fields?.middleName && (
                <Col xs={24} md={8}>
                  <Form.Item label="Отчество" name="middleName">
                    <Input maxLength={60} />
                  </Form.Item>
                </Col>
              )}
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="E-mail" name="email" rules={[{ required: true, type: "email", message: "Введите корректный e-mail" }]}>
                  <Input type="email" inputMode="email" maxLength={200} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Телефон" name="phone" rules={[{ required: true, message: "Введите телефон" }]}>
                  <Input type="tel" inputMode="tel" placeholder="+7 (900) 000-00-00" maxLength={20} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Специальность" name="specialtyId" rules={[{ required: true, message: "Выберите специальность" }]}>
                  <Select
                    showSearch={{ optionFilterProp: "label" }}
                    options={dictionaryOptions(specialties.data)}
                    notFoundContent="Нет вариантов. Специальности добавляются в разделе «Настройки»"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Город" name="city" rules={[{ required: true, message: "Введите город" }]}>
                  <Input maxLength={100} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              {fields?.workplace && (
                <Col xs={24} md={12}>
                  <Form.Item label="Место работы" name="workplace">
                    <Input maxLength={300} />
                  </Form.Item>
                </Col>
              )}
              {fields?.position && (
                <Col xs={24} md={12}>
                  <Form.Item label="Должность" name="position">
                    <Input maxLength={200} />
                  </Form.Item>
                </Col>
              )}
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Формат участия" name="format" rules={[{ required: true, message: "Выберите формат" }]}>
                  <Select options={event.settings.registrationFormats.map((f) => ({ value: f, label: formatLabels[f] }))} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="consentPersonalData"
              valuePropName="checked"
              rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error("Без согласия заявку добавить нельзя"))) }]}
              style={{ marginBottom: 8 }}
            >
              <Checkbox>Участник дал согласие на обработку персональных данных</Checkbox>
            </Form.Item>
            {fields?.mailingConsent && (
              <Form.Item name="consentMailing" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>Согласие на рассылку</Checkbox>
              </Form.Item>
            )}
          </Form>
        </>
      )}
    </Modal>
  );
}
