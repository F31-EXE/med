import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { Alert, App, Button, Card, Col, DatePicker, Flex, Form, Input, Modal, Radio, Result, Row, Space, Spin, Typography } from "antd";
import { ArrowLeftOutlined, ExportOutlined } from "@ant-design/icons";
import { api, ApiError } from "../../api/client";
import { applyFieldErrors } from "../../api/forms";
import type { UploadedImage } from "../../api/uploads";
import { EventSelect } from "../../components/EventSelect";
import { GalleryEditor, type GalleryImage } from "../../components/GalleryEditor";
import { ImageUpload } from "../../components/ImageUpload";
import { RichTextEditor } from "../../components/RichTextEditor";
import { NewsStateTag, useNewsActions } from "./NewsListPage";
import { dateTime, type News } from "./newsTypes";

type Mode = "draft" | "now" | "schedule";

type Values = {
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  body?: string | null;
  cover: UploadedImage | null;
  eventId: string | null;
  images: GalleryImage[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  mode: Mode;
  publishAt: Dayjs | null;
};

const fieldNames = ["title", "slug", "excerpt", "body", "cover", "eventId", "images", "seoTitle", "seoDescription", "mode", "publishAt"] as const;

function toForm(n: News): Values {
  return {
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    body: n.body,
    cover: n.coverUrl && n.coverThumbUrl ? { url: n.coverUrl, thumbUrl: n.coverThumbUrl } : null,
    eventId: n.eventId,
    images: n.images,
    seoTitle: n.seoTitle,
    seoDescription: n.seoDescription,
    mode: n.state === "scheduled" ? "schedule" : n.state === "published" ? "now" : "draft",
    publishAt: n.state === "scheduled" && n.publishAt ? dayjs(n.publishAt) : null,
  };
}

function toApi(v: Values) {
  return {
    title: v.title,
    slug: v.slug || null,
    excerpt: v.excerpt,
    body: v.body,
    coverUrl: v.cover?.url ?? null,
    coverThumbUrl: v.cover?.thumbUrl ?? null,
    eventId: v.eventId ?? null,
    images: v.images.map(({ url, thumbUrl, caption }) => ({ url, thumbUrl, caption })),
    seoTitle: v.seoTitle,
    seoDescription: v.seoDescription,
    status: v.mode === "draft" ? "DRAFT" : "PUBLISHED",
    publishAt: v.mode === "schedule" && v.publishAt ? v.publishAt.toISOString() : null,
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} style={{ marginBottom: 16 }}>
      {children}
    </Card>
  );
}

export function NewsFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const actions = useNewsActions();
  const mode = Form.useWatch("mode", form);

  const query = useQuery({
    queryKey: ["news-item", id],
    queryFn: () => api<{ news: News }>(`/news/${id}`).then((r) => r.news),
    enabled: !isNew,
  });
  const news = query.data;

  useEffect(() => {
    if (isNew) form.setFieldsValue({ mode: "draft", images: [], cover: null, eventId: null, publishAt: null });
    else if (news) form.setFieldsValue(toForm(news));
  }, [isNew, news, form]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      isNew ? api<{ news: News }>("/news", { body: toApi(v) }) : api<{ news: News }>(`/news/${id}`, { method: "PUT", body: toApi(v) }),
    onSuccess: ({ news: saved }) => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      queryClient.setQueryData(["news-item", saved.id], saved);
      message.success(
        saved.state === "scheduled"
          ? `Сохранено. Публикация ${dateTime.format(new Date(saved.publishAt!))}`
          : saved.state === "published"
            ? "Сохранено и опубликовано"
            : "Черновик сохранён",
      );
      if (isNew) navigate(`/news/${saved.id}`, { replace: true });
      else {
        form.setFieldsValue(toForm(saved));
        form.setFields(fieldNames.map((name) => ({ name, errors: [] })));
      }
    },
    onError: (e) => {
      if (!applyFieldErrors(form, e)) message.error(e.message);
      else message.error(e.message);
    },
  });

  function submit() {
    form
      .validateFields()
      .then((v) => save.mutate(v))
      .catch(() => message.error("Проверьте правильность заполнения полей"));
  }

  if (!isNew && query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 64 }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (!isNew && query.isError) {
    return (
      <Result
        status={query.error instanceof ApiError && query.error.status === 404 ? "404" : "error"}
        title={query.error.message}
        extra={<Link to="/news">К списку новостей</Link>}
      />
    );
  }

  const deleted = news?.state === "deleted";

  return (
    <div style={{ maxWidth: 1000 }}>
      <Link to="/news" style={{ display: "inline-block", marginBottom: 8 }}>
        <ArrowLeftOutlined /> Новости
      </Link>
      <Flex justify="space-between" align="flex-start" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {isNew ? "Новая новость" : news?.title}
          </Typography.Title>
          {news && (
            <div style={{ marginTop: 8 }}>
              <NewsStateTag item={news} />
            </div>
          )}
        </div>
        {news && !deleted && (
          <Space wrap>
            {news.state === "published" && (
              <Button href={`/news/${news.slug}`} target="_blank" icon={<ExportOutlined />}>
                На сайте
              </Button>
            )}
            <Button
              danger
              onClick={() =>
                Modal.confirm({
                  title: "Удалить новость?",
                  content: "Она попадёт в корзину. Восстановить её можно в течение 30 дней.",
                  okText: "Удалить",
                  okButtonProps: { danger: true },
                  cancelText: "Отмена",
                  onOk: async () => {
                    await actions.remove.mutateAsync(news.id);
                    navigate("/news");
                  },
                })
              }
            >
              Удалить
            </Button>
          </Space>
        )}
      </Flex>

      {deleted && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Новость в корзине"
          description={`Редактирование недоступно. Окончательное удаление ${news.purgeAt ? new Date(news.purgeAt).toLocaleDateString("ru-RU") : ""}.`}
          action={
            <Button onClick={() => actions.restore.mutate(news.id)} loading={actions.restore.isPending}>
              Восстановить
            </Button>
          }
        />
      )}

      <Form<Values> form={form} layout="vertical" disabled={deleted || save.isPending} scrollToFirstError={{ behavior: "smooth", block: "center" }}>
        <Section title="Публикация">
          <Form.Item name="mode" style={{ marginBottom: mode === "schedule" ? 12 : 0 }}>
            <Radio.Group
              options={[
                { value: "draft", label: "Черновик" },
                { value: "now", label: news?.state === "published" ? "Опубликована" : "Опубликовать сразу" },
                { value: "schedule", label: "Запланировать" },
              ]}
            />
          </Form.Item>
          {mode === "schedule" && (
            <Form.Item
              label="Дата и время публикации"
              name="publishAt"
              rules={[
                { required: true, message: "Укажите дату и время" },
                {
                  validator: (_, v: Dayjs | null) =>
                    !v || v.isAfter(dayjs()) ? Promise.resolve() : Promise.reject(new Error("Время должно быть в будущем")),
                },
              ]}
              extra="До этого момента новость не видна на сайте"
              style={{ marginBottom: 0 }}
            >
              <DatePicker
                showTime={{ format: "HH:mm", minuteStep: 5 }}
                format="DD.MM.YYYY HH:mm"
                disabledDate={(d) => d.isBefore(dayjs(), "day")}
                style={{ width: 260 }}
              />
            </Form.Item>
          )}
          {mode === "now" && news?.state === "published" && news.publishAt && (
            <Typography.Text type="secondary">Опубликована {dateTime.format(new Date(news.publishAt))}</Typography.Text>
          )}
        </Section>

        <Section title="Текст">
          <Form.Item label="Заголовок" name="title" rules={[{ required: true, min: 3, message: "Введите заголовок" }]}>
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item label="Анонс" name="excerpt" extra="Короткий текст для ленты новостей и превью в мессенджерах">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={400} showCount />
          </Form.Item>
          <Form.Item label="Текст новости" name="body" extra="Заголовки, выделение, списки, цитаты и ссылки — на панели над текстом. Текст из Word вставляется с форматированием.">
            <RichTextEditor placeholder="Начните писать текст новости…" maxChars={50000} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Мероприятие" name="eventId" extra="Новость появится на странице этого мероприятия">
                <EventSelect />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Адрес страницы"
                name="slug"
                extra={isNew ? "Если оставить пустым, адрес сформируется из заголовка" : undefined}
                rules={[{ pattern: /^[a-z0-9-]*$/, message: "Только латинские буквы, цифры и дефис" }]}
              >
                <Input addonBefore="/news/" placeholder={isNew ? "сформируется автоматически" : undefined} maxLength={80} />
              </Form.Item>
            </Col>
          </Row>
        </Section>

        <Section title="Фото">
          <Form.Item label="Обложка" name="cover" extra="Показывается в ленте и вверху новости. Лучше горизонтальное фото от 1600 px по ширине.">
            <ImageUpload preset="cover" />
          </Form.Item>
          <Form.Item label="Галерея" name="images" style={{ marginBottom: 0 }}>
            <GalleryEditor />
          </Form.Item>
        </Section>

        <Section title="SEO">
          <Form.Item label="Заголовок (title)" name="seoTitle" extra="Если пусто — заголовок новости">
            <Input maxLength={120} showCount />
          </Form.Item>
          <Form.Item label="Описание (description)" name="seoDescription" extra="Если пусто — анонс" style={{ marginBottom: 0 }}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={300} showCount />
          </Form.Item>
        </Section>
      </Form>

      {!deleted && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#fff", borderTop: "1px solid #f0f0f0", padding: "12px 16px", margin: "0 -16px" }}>
          <Space wrap>
            <Button type="primary" onClick={submit} loading={save.isPending}>
              {mode === "schedule" ? "Запланировать" : mode === "now" ? (news?.state === "published" ? "Сохранить" : "Опубликовать") : "Сохранить черновик"}
            </Button>
            <Link to="/news">
              <Button type="text">Отмена</Button>
            </Link>
          </Space>
        </div>
      )}
    </div>
  );
}
