import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Avatar, Button, Card, Checkbox, Col, Empty, Flex, Form, Input, Result, Row, Spin, Statistic, Tag, Typography } from "antd";
import { PictureOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "../api/client";
import { applyFieldErrors } from "../api/forms";
import { formatDateRange, formatLabels, type EventFormat } from "./events/eventTypes";
import { formatPhone } from "./registrations/registrationTypes";

type Person = { name: string; position: string | null; photoThumbUrl: string | null; quote?: string };

type Site = {
  contacts: {
    headerPhone: string | null;
    phones: { label: string | null; number: string }[];
    emails: { label: string | null; email: string }[];
    address: string | null;
    workHours: string | null;
    requisites: string | null;
    socials: { vk: string | null; telegram: string | null; youtube: string | null };
  };
  numbers: { value: string; label: string }[];
  pages: Record<
    "home" | "about" | "contacts",
    { title: string; path: string | null; body: string | null; blocks: { heroTitle?: string; heroSubtitle?: string; heroButtonText?: string; team?: Person[]; reviews?: Person[] } }
  >;
  events: {
    id: string;
    title: string;
    subtitle: string | null;
    format: EventFormat;
    startDate: string;
    endDate: string;
    nmoPoints: number | null;
    venueName: string | null;
    coverThumbUrl: string | null;
    city: string | null;
  }[];
  news: { id: string; title: string; excerpt: string | null; coverThumbUrl: string | null; publishAt: string | null }[];
  partners: { id: string; name: string; url: string | null; logoThumbUrl: string | null }[];
};

const dateFmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" });

function Paragraphs({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <Typography.Paragraph key={i} style={{ whiteSpace: "pre-line" }}>
          {p}
        </Typography.Paragraph>
      ))}
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>
        {title}
      </Typography.Title>
      {hint && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          {hint}
        </Typography.Paragraph>
      )}
      {children}
    </section>
  );
}

function ContactForm({ buttonText }: { buttonText: string }) {
  const [form] = Form.useForm();
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: (v: Record<string, unknown>) => api("/public/contact-requests", { body: { ...v, source: "Тестовая страница" } }),
    onSuccess: () => {
      setSent(true);
      form.resetFields();
    },
    onError: (e) => applyFieldErrors(form, e),
  });

  if (sent) {
    return (
      <Result
        status="success"
        title="Спасибо, заявка принята"
        subTitle="Менеджер свяжется с вами. Заявка уже видна в админке в разделе «Обращения»."
        extra={<Button onClick={() => setSent(false)}>Отправить ещё одну</Button>}
      />
    );
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => send.mutate(v)} disabled={send.isPending}>
      {send.isError && !(send.error as { fields?: unknown }).fields && <Alert type="error" showIcon title={send.error.message} style={{ marginBottom: 16 }} />}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Имя" name="name" rules={[{ required: true, min: 2, message: "Введите имя" }]}>
            <Input maxLength={120} autoComplete="name" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Организация" name="organization">
            <Input maxLength={200} autoComplete="organization" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Телефон" name="phone" dependencies={["email"]} rules={[({ getFieldValue }) => ({ validator: (_, v) => (v || getFieldValue("email") ? Promise.resolve() : Promise.reject(new Error("Укажите телефон или e-mail"))) })]}>
            <Input type="tel" inputMode="tel" placeholder="+7 (900) 000-00-00" maxLength={20} autoComplete="tel" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="E-mail" name="email" rules={[{ type: "email", message: "Введите корректный e-mail" }]}>
            <Input type="email" inputMode="email" maxLength={200} autoComplete="email" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="Комментарий" name="comment">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={3000} />
      </Form.Item>
      <Form.Item name="website" hidden>
        <Input tabIndex={-1} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="consent"
        valuePropName="checked"
        rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error("Нужно согласие на обработку персональных данных"))) }]}
      >
        <Checkbox>Я согласен на обработку персональных данных</Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={send.isPending}>
        {buttonText}
      </Button>
    </Form>
  );
}

export function PreviewPage() {
  const site = useQuery({ queryKey: ["public-site"], queryFn: () => api<Site>("/public/site") });

  if (site.isPending) {
    return (
      <Flex justify="center" style={{ padding: 96 }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (site.isError) return <Result status="error" title={site.error.message} />;

  const { contacts, numbers, pages, events, news, partners } = site.data;
  const hero = pages.home.blocks;

  return (
    <div style={{ background: "#F3F6FA", minHeight: "100vh" }}>
      <div style={{ background: "#FFF8E1", borderBottom: "1px solid #FFE58F", padding: "8px 16px", fontSize: 13, textAlign: "center" }}>
        Тестовая страница: данные из админки в том виде, в каком их получит сайт. Это не дизайн сайта. <Link to="/">Вернуться в админку</Link>
      </div>

      <header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
        <Flex justify="space-between" align="center" wrap gap={12} style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px" }}>
          <b>Media Expo Group</b>
          <Flex gap={16} align="center" wrap>
            {contacts.headerPhone ? <a href={`tel:${contacts.headerPhone.replace(/[^\d+]/g, "")}`}>{contacts.headerPhone}</a> : <Typography.Text type="secondary">телефон в шапке не задан</Typography.Text>}
            <Button type="primary" href="#contact">
              {hero.heroButtonText || "Оставить заявку"}
            </Button>
          </Flex>
        </Flex>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
        <Section title={hero.heroTitle || pages.home.title} hint={hero.heroTitle ? undefined : "Заголовок первого экрана не задан — показан заголовок страницы «Главная»"}>
          {hero.heroSubtitle && <Typography.Paragraph style={{ fontSize: 18 }}>{hero.heroSubtitle}</Typography.Paragraph>}
          <Paragraphs text={pages.home.body} />
        </Section>

        <Section title="Цифры компании" hint="Настройки → Цифры компании">
          {numbers.length ? (
            <Row gutter={[16, 16]}>
              {numbers.map((n, i) => (
                <Col key={i} xs={12} md={6}>
                  <Card size="small">
                    <Statistic title={n.label} value={n.value} />
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="Цифры не заданы" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Section>

        <Section title="Ближайшие мероприятия" hint="Только опубликованные и ещё не прошедшие, по дате начала">
          {events.length ? (
            <Row gutter={[16, 16]}>
              {events.map((e) => (
                <Col key={e.id} xs={24} md={12} lg={8}>
                  <Card
                    size="small"
                    cover={
                      e.coverThumbUrl ? (
                        <img src={e.coverThumbUrl} alt="" style={{ aspectRatio: "16 / 9", objectFit: "cover" }} />
                      ) : (
                        <div style={{ aspectRatio: "16 / 9", background: "#E6EEF8", display: "grid", placeItems: "center", color: "#8c8c8c" }}>
                          <PictureOutlined /> нет обложки
                        </div>
                      )
                    }
                  >
                    <Flex gap={4} wrap style={{ marginBottom: 6 }}>
                      <Tag>{formatLabels[e.format]}</Tag>
                      {e.nmoPoints ? <Tag color="blue">НМО: {e.nmoPoints}</Tag> : null}
                    </Flex>
                    <Typography.Text strong>{e.title}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {formatDateRange(e.startDate, e.endDate)}
                        {e.city ? ` · ${e.city}` : ""}
                        {e.venueName ? `, ${e.venueName}` : ""}
                      </Typography.Text>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="Нет опубликованных предстоящих мероприятий" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Section>

        <Section title="Новости" hint="Три последние опубликованные; запланированные появятся в свой срок">
          {news.length ? (
            <Row gutter={[16, 16]}>
              {news.map((n) => (
                <Col key={n.id} xs={24} md={8}>
                  <Card size="small" cover={n.coverThumbUrl ? <img src={n.coverThumbUrl} alt="" style={{ aspectRatio: "16 / 9", objectFit: "cover" }} /> : undefined}>
                    {n.publishAt && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {dateFmt.format(new Date(n.publishAt))}
                      </Typography.Text>
                    )}
                    <div>
                      <Typography.Text strong>{n.title}</Typography.Text>
                    </div>
                    {n.excerpt && <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>{n.excerpt}</Typography.Paragraph>}
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="Опубликованных новостей нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Section>

        <Section title={pages.about.title} hint={`Страница ${pages.about.path ?? ""}`}>
          <Paragraphs text={pages.about.body} />
          {!!pages.about.blocks.team?.length && (
            <>
              <Typography.Title level={5}>Команда</Typography.Title>
              <Flex gap={16} wrap style={{ marginBottom: 16 }}>
                {pages.about.blocks.team.map((p, i) => (
                  <Flex key={i} gap={8} align="center" style={{ minWidth: 220 }}>
                    <Avatar size={48} src={p.photoThumbUrl ?? undefined} icon={<UserOutlined />} />
                    <div>
                      <div>{p.name}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {p.position}
                      </Typography.Text>
                    </div>
                  </Flex>
                ))}
              </Flex>
            </>
          )}
          {!!pages.about.blocks.reviews?.length && (
            <>
              <Typography.Title level={5}>Отзывы</Typography.Title>
              <Row gutter={[16, 16]}>
                {pages.about.blocks.reviews.map((r, i) => (
                  <Col key={i} xs={24} md={12}>
                    <Card size="small">
                      <Typography.Paragraph italic>«{r.quote}»</Typography.Paragraph>
                      <Typography.Text strong>{r.name}</Typography.Text>
                      {r.position && <Typography.Text type="secondary">, {r.position}</Typography.Text>}
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}
          {!pages.about.body && !pages.about.blocks.team?.length && !pages.about.blocks.reviews?.length && (
            <Empty description="Страница «О компании» не заполнена" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Section>

        <Section title="Партнёры" hint="Партнёры с отметкой «Лента на главной», в заданном порядке">
          {partners.length ? (
            <Flex gap={16} wrap>
              {partners.map((p) => {
                const logo = (
                  <div style={{ width: 160, height: 80, background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, display: "grid", placeItems: "center", padding: 8 }}>
                    {p.logoThumbUrl ? <img src={p.logoThumbUrl} alt={p.name} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span>{p.name}</span>}
                  </div>
                );
                return p.url ? (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={p.name}>
                    {logo}
                  </a>
                ) : (
                  <div key={p.id}>{logo}</div>
                );
              })}
            </Flex>
          ) : (
            <Empty description="В ленте партнёров никого" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Section>

        <Row gutter={[24, 24]} id="contact">
          <Col xs={24} md={10}>
            <Section title={pages.contacts.title} hint="Настройки → Контакты">
              {contacts.phones.map((p, i) => (
                <div key={i}>
                  <a href={`tel:${p.number.replace(/[^\d+]/g, "")}`}>{formatPhone(p.number)}</a>
                  {p.label && <Typography.Text type="secondary"> — {p.label}</Typography.Text>}
                </div>
              ))}
              {contacts.emails.map((e, i) => (
                <div key={i}>
                  <a href={`mailto:${e.email}`}>{e.email}</a>
                  {e.label && <Typography.Text type="secondary"> — {e.label}</Typography.Text>}
                </div>
              ))}
              {contacts.address && <Typography.Paragraph style={{ marginTop: 12, marginBottom: 4 }}>{contacts.address}</Typography.Paragraph>}
              {contacts.workHours && <Typography.Paragraph type="secondary">{contacts.workHours}</Typography.Paragraph>}
              <Paragraphs text={pages.contacts.body} />
              <Flex gap={12} wrap>
                {contacts.socials.vk && <a href={contacts.socials.vk} target="_blank" rel="noreferrer">ВКонтакте</a>}
                {contacts.socials.telegram && <a href={contacts.socials.telegram} target="_blank" rel="noreferrer">Telegram</a>}
                {contacts.socials.youtube && <a href={contacts.socials.youtube} target="_blank" rel="noreferrer">Видео</a>}
              </Flex>
              {contacts.requisites && (
                <Typography.Paragraph type="secondary" style={{ whiteSpace: "pre-line", fontSize: 13, marginTop: 12 }}>
                  {contacts.requisites}
                </Typography.Paragraph>
              )}
            </Section>
          </Col>
          <Col xs={24} md={14}>
            <Card title="Форма обратной связи">
              <ContactForm buttonText={hero.heroButtonText || "Отправить заявку"} />
            </Card>
          </Col>
        </Row>
      </main>
    </div>
  );
}
