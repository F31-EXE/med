import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from "antd";
import { ArrowLeftOutlined, DeleteOutlined, MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { api, ApiError } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import { dictionaryOptions, useDictionary } from "../../api/dictionaries";
import { formatOptions, modeOptions, type EventDetail, type Tariff } from "./eventTypes";
import { StatusTags } from "./EventsListPage";
import { useEventActions } from "./useEventActions";
import { EventTabs } from "./EventTabs";
import { ImageUpload } from "../../components/ImageUpload";
import type { UploadedImage } from "../../api/uploads";

const { RangePicker } = DatePicker;
const { TextArea } = Input;

type FormValues = Omit<
  EventDetail,
  "id" | "startDate" | "endDate" | "registrationDeadline" | "coverUrl" | "coverThumbUrl" | "status" | "state" | "city" | "directions" | "deletedAt" | "purgeAt" | "updatedAt" | "archivedAt" | "publishedAt"
> & {
  dates: [Dayjs, Dayjs];
  registrationDeadline: Dayjs | null;
  cover: UploadedImage | null;
};

const emptyValues: Partial<FormValues> = {
  attendanceMode: "OFFLINE",
  directionIds: [],
  keyFacts: [],
  tariffs: [],
  registrationEnabled: true,
  showRegistrationCount: false,
  cover: null,
};

function toForm(e: EventDetail): FormValues {
  return {
    ...e,
    dates: [dayjs(e.startDate), dayjs(e.endDate)],
    registrationDeadline: e.registrationDeadline ? dayjs(e.registrationDeadline) : null,
    cover: e.coverUrl && e.coverThumbUrl ? { url: e.coverUrl, thumbUrl: e.coverThumbUrl } : null,
  };
}

function toApi(v: FormValues) {
  const { dates, registrationDeadline, cover, ...rest } = v;
  return {
    ...rest,
    coverUrl: cover?.url ?? null,
    coverThumbUrl: cover?.thumbUrl ?? null,
    slug: rest.slug || null,
    startDate: dates[0].format("YYYY-MM-DD"),
    endDate: dates[1].format("YYYY-MM-DD"),
    registrationDeadline: registrationDeadline ? registrationDeadline.toISOString() : null,
    tariffs: (rest.tariffs ?? []).map(({ id: _id, ...t }: Tariff) => t),
  };
}

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <Card title={title} extra={extra} style={{ marginBottom: 16 }}>
      {children}
    </Card>
  );
}

export function EventFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const actions = useEventActions();
  const directions = useDictionary("directions");
  const cities = useDictionary("cities");

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: () => api<{ event: EventDetail }>(`/events/${id}`).then((r) => r.event),
    enabled: !isNew,
  });
  const event = eventQuery.data;

  useEffect(() => {
    if (isNew) form.setFieldsValue(emptyValues as FormValues);
    else if (event) form.setFieldsValue(toForm(event));
  }, [isNew, event, form]);

  const save = useMutation({
    mutationFn: async ({ values, publish }: { values: FormValues; publish?: boolean }) => {
      const body = toApi(values);
      let saved = isNew
        ? (await api<{ event: EventDetail }>("/events", { body })).event
        : (await api<{ event: EventDetail }>(`/events/${id}`, { method: "PUT", body })).event;
      if (publish && saved.status !== "PUBLISHED") {
        saved = (await api<{ event: EventDetail }>(`/events/${saved.id}/status`, { body: { status: "PUBLISHED" } })).event;
      }
      return saved;
    },
    onSuccess: (saved, { publish }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.setQueryData(["event", saved.id], saved);
      message.success(publish ? "Сохранено и опубликовано" : "Сохранено");
      if (isNew) navigate(`/events/${saved.id}`, { replace: true });
      else form.setFieldsValue(toForm(saved));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        const { startDate, endDate, ...rest } = e.fields;
        applyFieldErrors(form, new ApiError(e.status, e.message, rest));
        if (startDate || endDate) form.setFields([{ name: "dates", errors: [startDate || endDate] }]);
        message.error(e.message);
      } else {
        message.error(e.message);
      }
    },
  });

  function submit(publish = false) {
    form
      .validateFields()
      .then((values) => save.mutate({ values, publish }))
      .catch(() => message.error("Проверьте правильность заполнения полей"));
  }

  if (!isNew && eventQuery.isPending) {
    return (
      <Flex justify="center" style={{ padding: 64 }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (!isNew && eventQuery.isError) {
    return (
      <Result
        status={eventQuery.error instanceof ApiError && eventQuery.error.status === 404 ? "404" : "error"}
        title={eventQuery.error.message}
        extra={<Link to="/events">К списку мероприятий</Link>}
      />
    );
  }

  const deleted = event?.state === "deleted";
  const busy = save.isPending;

  return (
    <div style={{ maxWidth: 1000 }}>
      <Link to="/events" style={{ display: "inline-block", marginBottom: 8 }}>
        <ArrowLeftOutlined /> Мероприятия
      </Link>
      <Flex justify="space-between" align="flex-start" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {isNew ? "Новое мероприятие" : event?.title}
          </Typography.Title>
          {event && (
            <div style={{ marginTop: 8 }}>
              <StatusTags item={event} />
            </div>
          )}
        </div>
        {event && !deleted && (
          <Space wrap>
            <Button
              onClick={() => actions.setStatus.mutate({ id: event.id, status: event.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })}
              loading={actions.setStatus.isPending}
            >
              {event.status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать"}
            </Button>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "copy", label: "Создать копию" },
                  { key: "archive", label: event.state === "archived" ? "Вернуть из архива" : "Перенести в архив" },
                  { type: "divider" },
                  { key: "delete", label: "Удалить", danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === "copy") actions.copy.mutate(event.id);
                  if (key === "archive") actions.setArchived.mutate({ id: event.id, archived: event.state !== "archived" });
                  if (key === "delete") {
                    Modal.confirm({
                      title: "Удалить мероприятие?",
                      content: "Оно попадёт в корзину. Восстановить его можно в течение 30 дней.",
                      okText: "Удалить",
                      okButtonProps: { danger: true },
                      cancelText: "Отмена",
                      onOk: async () => {
                        await actions.remove.mutateAsync(event.id);
                        navigate("/events");
                      },
                    });
                  }
                },
              }}
            >
              <Button icon={<MoreOutlined />} aria-label="Ещё действия" />
            </Dropdown>
          </Space>
        )}
      </Flex>

      <EventTabs id={id} active="main" />

      {deleted && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Мероприятие в корзине"
          description={`Редактирование недоступно. Окончательное удаление ${event.purgeAt ? new Date(event.purgeAt).toLocaleDateString("ru-RU") : ""}.`}
          action={
            <Button onClick={() => actions.restore.mutate(event.id)} loading={actions.restore.isPending}>
              Восстановить
            </Button>
          }
        />
      )}
      {event?.state === "archived" && !event.archivedAt && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Мероприятие прошло и показывается на сайте в архиве"
        />
      )}

      <Form<FormValues> form={form} layout="vertical" disabled={deleted || busy} scrollToFirstError={{ behavior: "smooth", block: "center" }}>
        <Section title="Основное">
          <Form.Item label="Название" name="title" rules={[{ required: true, min: 3, message: "Введите название" }]}>
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item label="Обложка" name="cover" extra="Фото для карточки в каталоге и шапки страницы. Лучше горизонтальное, от 1600 px по ширине.">
            <ImageUpload preset="cover" />
          </Form.Item>
          <Form.Item label="Тема или подзаголовок" name="subtitle">
            <Input maxLength={300} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Формат" name="format" rules={[{ required: true, message: "Выберите формат" }]}>
                <Select options={formatOptions} placeholder="Выберите" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Участие" name="attendanceMode">
                <Select options={modeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Баллы НМО" name="nmoPoints" extra="Оставьте пустым, если баллы не начисляются">
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Направления" name="directionIds">
            <Select
              mode="multiple"
              allowClear
              placeholder="Выберите одно или несколько"
              showSearch={{ optionFilterProp: "label" }}
              options={dictionaryOptions(directions.data, event?.directionIds)}
              notFoundContent="Нет вариантов. Направления добавляются в разделе «Настройки»"
            />
          </Form.Item>
          <Form.Item
            label="Адрес страницы"
            name="slug"
            extra={isNew ? "Если оставить пустым, адрес сформируется из названия и года" : undefined}
            rules={[{ pattern: /^[a-z0-9-]*$/, message: "Только латинские буквы, цифры и дефис" }]}
          >
            <Input addonBefore="med-expo.org/events/" placeholder={isNew ? "сформируется автоматически" : undefined} maxLength={80} />
          </Form.Item>
        </Section>

        <Section title="Даты и место">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Даты проведения" name="dates" rules={[{ required: true, message: "Укажите даты" }]}>
                <RangePicker format="DD.MM.YYYY" style={{ width: "100%" }} placeholder={["Начало", "Окончание"]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Город" name="cityId">
                <Select
                  allowClear
                  placeholder="Выберите"
                  showSearch={{ optionFilterProp: "label" }}
                  options={dictionaryOptions(cities.data, event?.cityId ? [event.cityId] : [])}
                  notFoundContent="Нет вариантов. Города добавляются в разделе «Настройки»"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Площадка" name="venueName">
                <Input maxLength={200} placeholder="Например, Екатеринбург-ЭКСПО" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Адрес" name="venueAddress">
                <Input maxLength={300} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Как добраться" name="venueHowToGet">
            <TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Парковка" name="venueParking">
                <TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={1000} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Проживание" name="venueAccommodation">
                <TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Form.Item label="Широта" name="venueLat">
                <InputNumber min={-90} max={90} step={0.000001} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Долгота" name="venueLng">
                <InputNumber min={-180} max={180} step={0.000001} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Typography.Paragraph type="secondary" style={{ marginTop: 30 }}>
                Координаты для метки на Яндекс.Карте. Их можно скопировать на maps.yandex.ru: правый клик по месту → «Что здесь?».
              </Typography.Paragraph>
            </Col>
          </Row>
        </Section>

        <Section title="О мероприятии">
          <Form.Item label="Описание" name="description">
            <TextArea autoSize={{ minRows: 5, maxRows: 20 }} maxLength={20000} showCount />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Ожидаемое число участников" name="expectedParticipants">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Организаторы" name="organizers">
            <TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder="Например, Российское кардиологическое общество" />
          </Form.Item>
          <Typography.Text strong>Ключевые факты</Typography.Text>
          <Typography.Paragraph type="secondary">Крупные цифры на странице: «1200 — участников», «40 — докладов».</Typography.Paragraph>
          <Form.List name="keyFacts">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Flex key={field.key} gap={8} align="flex-start">
                    <Form.Item name={[field.name, "value"]} rules={[{ required: true, message: "Цифра" }]} style={{ width: 120 }}>
                      <Input placeholder="1200" maxLength={30} />
                    </Form.Item>
                    <Form.Item name={[field.name, "label"]} rules={[{ required: true, message: "Подпись" }]} style={{ flex: 1 }}>
                      <Input placeholder="участников" maxLength={100} />
                    </Form.Item>
                    <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="Удалить факт" />
                  </Flex>
                ))}
                {fields.length < 8 && (
                  <Button icon={<PlusOutlined />} onClick={() => add({ value: "", label: "" })}>
                    Добавить факт
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Section>

        <Section title="Условия участия">
          <Form.List name="tariffs">
            {(fields, { add, remove }) => (
              <>
                {fields.length === 0 && (
                  <Typography.Paragraph type="secondary">Тарифов нет — блок на странице мероприятия будет скрыт.</Typography.Paragraph>
                )}
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    type="inner"
                    title={`Тариф ${index + 1}`}
                    extra={<Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="Удалить тариф" />}
                    style={{ marginBottom: 12 }}
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={8}>
                        <Form.Item label="Название" name={[field.name, "name"]} rules={[{ required: true, message: "Введите название" }]}>
                          <Input placeholder="Очное участие" maxLength={100} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={10}>
                        <Form.Item label="Для кого" name={[field.name, "audience"]}>
                          <Input placeholder="Врачи, ординаторы" maxLength={200} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item label="Цена, ₽" name={[field.name, "price"]} extra="Пусто — бесплатно">
                          <InputNumber min={0} step={500} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="Что входит" name={[field.name, "includes"]} style={{ marginBottom: 0 }}>
                      <TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder="Каждый пункт с новой строки" />
                    </Form.Item>
                  </Card>
                ))}
                {fields.length < 4 && (
                  <Button icon={<PlusOutlined />} onClick={() => add({ name: "", audience: null, price: null, includes: null })}>
                    Добавить тариф
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Section>

        <Section title="Регистрация">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Регистрация открыта" name="registrationEnabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Закрыть регистрацию" name="registrationDeadline" extra="Пусто — до начала мероприятия">
                <DatePicker showTime={{ format: "HH:mm" }} format="DD.MM.YYYY HH:mm" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Лимит мест" name="maxParticipants" extra="Пусто — без ограничения">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Показывать на сайте счётчик регистраций" name="showRegistrationCount" valuePropName="checked">
            <Switch />
          </Form.Item>
          {event && (
            <Typography.Text type="secondary">
              Форматы участия, поля формы и текст письма — в <Link to={`/registrations?eventId=${event.id}`}>разделе «Регистрации»</Link>.
            </Typography.Text>
          )}
        </Section>

        <Section title="SEO">
          <Form.Item label="Заголовок (title)" name="seoTitle" extra="Если пусто — название, даты и город">
            <Input maxLength={120} showCount />
          </Form.Item>
          <Form.Item label="Описание (description)" name="seoDescription" style={{ marginBottom: 0 }}>
            <TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={300} showCount />
          </Form.Item>
        </Section>
      </Form>

      {!deleted && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 10,
            background: "#fff",
            borderTop: "1px solid #f0f0f0",
            padding: "12px 16px",
            margin: "0 -16px",
          }}
        >
          <Space wrap>
            <Button type="primary" onClick={() => submit(false)} loading={busy && !save.variables?.publish}>
              {isNew ? "Сохранить черновик" : "Сохранить"}
            </Button>
            {(isNew || event?.status === "DRAFT") && (
              <Button onClick={() => submit(true)} loading={busy && save.variables?.publish}>
                Сохранить и опубликовать
              </Button>
            )}
            <Link to="/events">
              <Button type="text">Отмена</Button>
            </Link>
          </Space>
        </div>
      )}
    </div>
  );
}
