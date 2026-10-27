import { useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Col, Flex, Form, Input, InputNumber, Row, Select, Spin, Switch, Typography, type FormInstance } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { api, ApiError } from "../../api/client";

type Contacts = {
  headerPhone: string | null;
  phones: { label: string | null; number: string }[];
  emails: { label: string | null; email: string }[];
  address: string | null;
  workHours: string | null;
  requisites: string | null;
  mapLat: number | null;
  mapLng: number | null;
  socials: { vk: string | null; telegram: string | null; youtube: string | null };
};

export type SiteSettings = {
  contacts: Contacts;
  numbers: { value: string; label: string }[];
  notifications: { onRegistration: boolean; emails: string[] };
};

type Section = keyof SiteSettings;

const dateFmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: () => api<{ settings: SiteSettings; updatedAt: string | null }>("/settings"),
  });
}

function useSaveSection<S extends Section>(section: S, form: FormInstance<any>) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: SiteSettings[S]) => {
      const current = queryClient.getQueryData<{ settings: SiteSettings }>(["site-settings"])!.settings;
      return api<{ settings: SiteSettings; updatedAt: string }>("/settings", { method: "PUT", body: { ...current, [section]: value } });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["site-settings"], data);
      message.success("Настройки сохранены");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        const prefix = `${section}.`;
        const own = Object.entries(e.fields).filter(([k]) => k.startsWith(prefix));
        form.setFields(
          own.map(([k, error]) => ({
            name: k.slice(prefix.length).split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
            errors: [error],
          })),
        );
        message.error(own[0]?.[1] ?? e.message);
      } else {
        message.error(e.message);
      }
    },
  });
}

function Shell({ children, updatedAt, onSave, saving }: { children: ReactNode; updatedAt: string | null | undefined; onSave: () => void; saving: boolean }) {
  return (
    <div style={{ maxWidth: 820 }}>
      {children}
      <Flex align="center" gap={12} wrap style={{ marginTop: 8 }}>
        <Button type="primary" onClick={onSave} loading={saving}>
          Сохранить
        </Button>
        {updatedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Изменено {dateFmt.format(new Date(updatedAt))}
          </Typography.Text>
        )}
      </Flex>
    </div>
  );
}

export function ContactsSettings() {
  const [form] = Form.useForm<Contacts>();
  const query = useSiteSettings();
  const save = useSaveSection("contacts", form);
  useEffect(() => {
    if (query.data) form.setFieldsValue(query.data.settings.contacts);
  }, [query.data, form]);
  if (query.isPending) return <Spin />;

  return (
    <Shell updatedAt={query.data?.updatedAt} onSave={() => form.submit()} saving={save.isPending}>
      <Typography.Paragraph type="secondary">Контакты в шапке и подвале сайта и на странице «Контакты».</Typography.Paragraph>
      <Form<Contacts> form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
        <Form.Item label="Телефон в шапке" name="headerPhone" extra="Крупный номер рядом с кнопкой «Оставить заявку»">
          <Input placeholder="+7 (343) 000-00-00" inputMode="tel" maxLength={40} style={{ maxWidth: 320 }} />
        </Form.Item>

        <Typography.Text strong>Телефоны</Typography.Text>
        <Form.List name="phones">
          {(fields, { add, remove }) => (
            <div style={{ margin: "8px 0 16px" }}>
              {fields.map((f) => (
                <Flex key={f.key} gap={8} align="flex-start" wrap>
                  <Form.Item name={[f.name, "number"]} rules={[{ required: true, message: "Введите номер" }]} style={{ flex: "1 1 220px" }}>
                    <Input placeholder="+7 (343) 000-00-00 доб. 12" inputMode="tel" maxLength={40} />
                  </Form.Item>
                  <Form.Item name={[f.name, "label"]} style={{ flex: "1 1 220px" }}>
                    <Input placeholder="Подпись: отдел регистрации" maxLength={80} />
                  </Form.Item>
                  <Button icon={<DeleteOutlined />} onClick={() => remove(f.name)} aria-label="Удалить телефон" />
                </Flex>
              ))}
              {fields.length < 6 && (
                <Button icon={<PlusOutlined />} onClick={() => add({ number: "", label: null })}>
                  Добавить телефон
                </Button>
              )}
            </div>
          )}
        </Form.List>

        <Typography.Text strong>E-mail</Typography.Text>
        <Form.List name="emails">
          {(fields, { add, remove }) => (
            <div style={{ margin: "8px 0 16px" }}>
              {fields.map((f) => (
                <Flex key={f.key} gap={8} align="flex-start" wrap>
                  <Form.Item
                    name={[f.name, "email"]}
                    rules={[{ required: true, type: "email", message: "Введите корректный e-mail" }]}
                    style={{ flex: "1 1 220px" }}
                  >
                    <Input placeholder="info@med-expo.org" inputMode="email" maxLength={200} />
                  </Form.Item>
                  <Form.Item name={[f.name, "label"]} style={{ flex: "1 1 220px" }}>
                    <Input placeholder="Подпись: для экспонентов" maxLength={80} />
                  </Form.Item>
                  <Button icon={<DeleteOutlined />} onClick={() => remove(f.name)} aria-label="Удалить e-mail" />
                </Flex>
              ))}
              {fields.length < 6 && (
                <Button icon={<PlusOutlined />} onClick={() => add({ email: "", label: null })}>
                  Добавить e-mail
                </Button>
              )}
            </div>
          )}
        </Form.List>

        <Row gutter={16}>
          <Col xs={24} md={14}>
            <Form.Item label="Адрес" name="address">
              <Input maxLength={300} placeholder="Екатеринбург, ул. …" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item label="Режим работы" name="workHours">
              <Input maxLength={200} placeholder="Пн–Пт 9:00–18:00" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Form.Item label="Широта" name="mapLat">
              <InputNumber min={-90} max={90} step={0.000001} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Долгота" name="mapLng">
              <InputNumber min={-180} max={180} step={0.000001} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Paragraph type="secondary" style={{ marginTop: 30, fontSize: 13 }}>
              Метка офиса на Яндекс.Карте на странице «Контакты».
            </Typography.Paragraph>
          </Col>
        </Row>
        <Form.Item label="Реквизиты" name="requisites">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} maxLength={3000} placeholder={"ООО «МедиаЭкспоГрупп»\nИНН …, КПП …, ОГРН …"} />
        </Form.Item>
        <Typography.Text strong>Соцсети</Typography.Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col xs={24} md={8}>
            <Form.Item label="ВКонтакте" name={["socials", "vk"]}>
              <Input placeholder="vk.com/…" maxLength={300} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Telegram" name={["socials", "telegram"]}>
              <Input placeholder="t.me/…" maxLength={300} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="YouTube или RUTUBE" name={["socials", "youtube"]}>
              <Input placeholder="rutube.ru/…" maxLength={300} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Shell>
  );
}

export function NumbersSettings() {
  const [form] = Form.useForm<{ numbers: SiteSettings["numbers"] }>();
  const query = useSiteSettings();
  const save = useSaveSection("numbers", form);
  useEffect(() => {
    if (query.data) form.setFieldsValue({ numbers: query.data.settings.numbers });
  }, [query.data, form]);
  if (query.isPending) return <Spin />;

  return (
    <Shell updatedAt={query.data?.updatedAt} onSave={() => form.submit()} saving={save.isPending}>
      <Typography.Paragraph type="secondary">
        Блок «Цифры» на главной и на странице «О компании»: лет опыта, мероприятий, участников, врачей-спикеров. До шести пунктов.
      </Typography.Paragraph>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v.numbers ?? [])}>
        <Form.List name="numbers">
          {(fields, { add, remove, move }) => (
            <>
              {fields.map((f, i) => (
                <Flex key={f.key} gap={8} align="flex-start" wrap>
                  <Form.Item name={[f.name, "value"]} rules={[{ required: true, message: "Цифра" }]} style={{ width: 140 }}>
                    <Input placeholder="300+" maxLength={20} />
                  </Form.Item>
                  <Form.Item name={[f.name, "label"]} rules={[{ required: true, message: "Подпись" }]} style={{ flex: "1 1 240px" }}>
                    <Input placeholder="мероприятий проведено" maxLength={80} />
                  </Form.Item>
                  <Button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Выше">
                    ↑
                  </Button>
                  <Button onClick={() => move(i, i + 1)} disabled={i === fields.length - 1} aria-label="Ниже">
                    ↓
                  </Button>
                  <Button icon={<DeleteOutlined />} onClick={() => remove(f.name)} aria-label="Удалить" />
                </Flex>
              ))}
              {fields.length < 6 && (
                <Button icon={<PlusOutlined />} onClick={() => add({ value: "", label: "" })} style={{ marginBottom: 8 }}>
                  Добавить цифру
                </Button>
              )}
            </>
          )}
        </Form.List>
      </Form>
    </Shell>
  );
}

export function NotificationsSettings() {
  const [form] = Form.useForm<SiteSettings["notifications"]>();
  const query = useSiteSettings();
  const save = useSaveSection("notifications", form);
  const on = Form.useWatch("onRegistration", form);
  useEffect(() => {
    if (query.data) form.setFieldsValue(query.data.settings.notifications);
  }, [query.data, form]);
  if (query.isPending) return <Spin />;

  return (
    <Shell updatedAt={query.data?.updatedAt} onSave={() => form.submit()} saving={save.isPending}>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
        <Form.Item name="onRegistration" valuePropName="checked" label="Уведомлять о новых заявках на регистрацию">
          <Switch />
        </Form.Item>
        <Form.Item
          label="Адреса для уведомлений"
          name="emails"
          extra="Введите адрес и нажмите Enter. Письмо приходит на каждый адрес при новой заявке с сайта."
          rules={[
            {
              validator: (_, v: string[] = []) => {
                const bad = v.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
                if (bad) return Promise.reject(new Error(`Некорректный e-mail: ${bad}`));
                if (on && !v.length) return Promise.reject(new Error("Укажите хотя бы один адрес или выключите уведомления"));
                return Promise.resolve();
              },
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[",", " ", ";"]} open={false} suffixIcon={null} placeholder="manager@med-expo.org" style={{ maxWidth: 520 }} />
        </Form.Item>
      </Form>
    </Shell>
  );
}
