import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Flex, Form, Input, Result, Space, Spin, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { api, ApiError } from "../../api/client";
import { SeoPreview } from "../../components/SeoPreview";
import { PeopleEditor } from "./PeopleEditor";
import type { PageDetail, Person, Review } from "./pageTypes";

type Values = {
  title: string;
  path?: string | null;
  body?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroButtonText?: string | null;
  team?: Person[];
  reviews?: Review[];
  seoTitle?: string | null;
  seoDescription?: string | null;
};

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <Card title={title} extra={extra} style={{ marginBottom: 16 }}>
      {children}
    </Card>
  );
}

function toForm(p: PageDetail): Values {
  return {
    title: p.title,
    path: p.path,
    body: p.body,
    heroTitle: p.blocks.heroTitle ?? null,
    heroSubtitle: p.blocks.heroSubtitle ?? null,
    heroButtonText: p.blocks.heroButtonText ?? null,
    team: p.blocks.team ?? [],
    reviews: p.blocks.reviews ?? [],
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  };
}

function toApi(p: PageDetail, v: Values) {
  const blocks =
    p.kind === "home"
      ? { heroTitle: v.heroTitle, heroSubtitle: v.heroSubtitle, heroButtonText: v.heroButtonText }
      : p.kind === "about"
        ? {
            team: (v.team ?? []).map(({ name, position, photoUrl, photoThumbUrl }) => ({ name, position, photoUrl, photoThumbUrl })),
            reviews: (v.reviews ?? []).map(({ quote, name, position, photoUrl, photoThumbUrl }) => ({ quote, name, position, photoUrl, photoThumbUrl })),
          }
        : {};
  return { title: v.title, path: p.pathEditable ? v.path : null, body: v.body, blocks, seoTitle: v.seoTitle, seoDescription: v.seoDescription };
}

export function PageEditPage() {
  const { key } = useParams();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<Values>();
  const watched = Form.useWatch([], form) as Values | undefined;

  const query = useQuery({
    queryKey: ["page", key],
    queryFn: () => api<{ page: PageDetail }>(`/pages/${key}`).then((r) => r.page),
  });
  const page = query.data;

  useEffect(() => {
    if (page) form.setFieldsValue(toForm(page));
  }, [page, form]);

  const save = useMutation({
    mutationFn: (v: Values) => api<{ page: PageDetail }>(`/pages/${key}`, { method: "PUT", body: toApi(page!, v) }).then((r) => r.page),
    onSuccess: (saved) => {
      message.success("Страница сохранена");
      queryClient.setQueryData(["page", key], saved);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      form.setFieldsValue(toForm(saved));
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        const known = ["title", "path", "body", "seoTitle", "seoDescription"];
        const formFields = Object.entries(e.fields).filter(([k]) => known.includes(k));
        form.setFields(formFields.map(([name, error]) => ({ name: name as keyof Values, errors: [error] })));
        const other = Object.entries(e.fields).find(([k]) => !known.includes(k));
        message.error(other ? other[1] : e.message);
      } else {
        message.error(e.message);
      }
    },
  });

  if (query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 64 }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (query.isError || !page) {
    return <Result status="404" title={query.error?.message ?? "Страница не найдена"} extra={<Link to="/pages">К списку страниц</Link>} />;
  }

  const team = watched?.team ?? [];
  const reviews = watched?.reviews ?? [];
  const incomplete = team.some((t) => !t.name?.trim()) || reviews.some((r) => !r.name?.trim() || !r.quote?.trim());

  return (
    <div style={{ maxWidth: 1000 }}>
      <Link to="/pages" style={{ display: "inline-block", marginBottom: 8 }}>
        <ArrowLeftOutlined /> Страницы и SEO
      </Link>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        {page.title}
      </Typography.Title>
      {page.hint && <Alert type="info" showIcon title={page.hint} style={{ marginBottom: 16 }} />}

      <Form<Values> form={form} layout="vertical" requiredMark={false} disabled={save.isPending} onFinish={(v) => save.mutate(v)}>
        <Section title="Страница">
          <Form.Item label="Заголовок (H1)" name="title" rules={[{ required: true, message: "Введите заголовок" }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            label="Адрес"
            name="path"
            extra={
              page.pathEditable
                ? "Если адрес уже проиндексирован, после смены не забудьте настроить 301-редирект со старого"
                : page.defaultPath
                  ? "Адрес этой страницы фиксирован"
                  : "У этой страницы нет своего адреса"
            }
            rules={page.pathEditable ? [{ pattern: /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/, message: "Адрес вида /about: латиница, цифры, дефис" }] : []}
          >
            <Input addonBefore="med-expo.org" disabled={!page.pathEditable} placeholder={page.defaultPath ?? "—"} maxLength={120} />
          </Form.Item>
          <Form.Item label="Текст" name="body" extra="Абзацы разделяйте пустой строкой" style={{ marginBottom: 0 }}>
            <Input.TextArea autoSize={{ minRows: page.kind === "text" ? 10 : 5, maxRows: 40 }} maxLength={100000} showCount />
          </Form.Item>
        </Section>

        {page.kind === "home" && (
          <Section title="Первый экран">
            <Form.Item label="Заголовок" name="heroTitle">
              <Input maxLength={200} placeholder="Медицинские конгрессы и конференции всероссийского уровня" />
            </Form.Item>
            <Form.Item label="Подзаголовок" name="heroSubtitle">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={500} />
            </Form.Item>
            <Form.Item label="Текст кнопки" name="heroButtonText" extra="Кнопка открывает форму заявки" style={{ marginBottom: 0 }}>
              <Input maxLength={60} placeholder="Оставить заявку" />
            </Form.Item>
          </Section>
        )}

        {page.kind === "about" && (
          <>
            <Section title="Команда">
              <Form.Item name="team" noStyle>
                <PeopleEditor<Person> max={50} addLabel="Добавить сотрудника" />
              </Form.Item>
            </Section>
            <Section title="Отзывы участников и партнёров">
              <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                Публикуйте отзывы только с согласия авторов.
              </Typography.Paragraph>
              <Form.Item name="reviews" noStyle>
                <PeopleEditor<Review> withQuote max={30} addLabel="Добавить отзыв" />
              </Form.Item>
            </Section>
          </>
        )}

        <Section title="SEO">
          <Form.Item label="Заголовок (title)" name="seoTitle">
            <Input maxLength={120} showCount />
          </Form.Item>
          <Form.Item label="Описание (description)" name="seoDescription">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={300} showCount />
          </Form.Item>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Так страница может выглядеть в поиске
          </Typography.Text>
          <SeoPreview
            title={watched?.seoTitle ?? ""}
            fallbackTitle={`${watched?.title || page.title} — Media Expo Group`}
            description={watched?.seoDescription ?? ""}
            path={page.pathEditable ? (watched?.path ?? page.path) : page.defaultPath}
          />
        </Section>
      </Form>

      <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#fff", borderTop: "1px solid #f0f0f0", padding: "12px 16px", margin: "0 -16px" }}>
        <Space wrap>
          <Button type="primary" onClick={() => form.submit()} loading={save.isPending}>
            Сохранить
          </Button>
          <Link to="/pages">
            <Button type="text">Назад</Button>
          </Link>
          {incomplete && <Typography.Text type="warning">Заполните имена и тексты отзывов, отмеченные жёлтым</Typography.Text>}
        </Space>
      </div>
    </div>
  );
}
