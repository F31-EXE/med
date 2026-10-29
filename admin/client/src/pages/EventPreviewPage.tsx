import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Anchor,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Flex,
  Form,
  Image,
  Input,
  Result,
  Row,
  Segmented,
  Select,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { ClockCircleOutlined, FileOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "../api/client";
import { applyFieldErrors } from "../api/forms";
import { formatDateRange, formatLabels, modeLabels, type AttendanceMode, type EventFormat } from "./events/eventTypes";
import { formatLabels as participationLabels, type ParticipationFormat, type RegistrationFields } from "./registrations/registrationTypes";
import { formatDayLabel } from "./events/program/programTypes";
import { formatSize } from "./documents/documentTypes";
import { levelLabels, levels, type PartnerLevel } from "./partners/partnerTypes";

type Speaker = { id: string; fullName: string; degree: string | null; position: string | null; photoThumbUrl: string | null };
type Doc = { title: string; description: string | null; url: string; extension: string; size: number; fileUpdatedAt: string };

type PublicEvent = {
  title: string;
  slug: string;
  subtitle: string | null;
  format: EventFormat;
  attendanceMode: AttendanceMode;
  startDate: string;
  endDate: string;
  city: string | null;
  directions: string[];
  nmoPoints: number | null;
  expectedParticipants: number | null;
  description: string | null;
  keyFacts: { value: string; label: string }[];
  organizers: string | null;
  coverUrl: string | null;
  venue: { name: string | null; address: string | null; howToGet: string | null; parking: string | null; accommodation: string | null; lat: number | null; lng: number | null };
  tariffs: { name: string; audience: string | null; price: number | null; includes: string | null }[];
  halls: { id: string; name: string }[];
  program: {
    id: string;
    date: string;
    title: string | null;
    sessions: {
      id: string;
      hallId: string | null;
      kind: "SESSION" | "BREAK";
      startTime: string;
      endTime: string;
      title: string;
      description: string | null;
      nmo: boolean;
      speakers: (Speaker & { role: "MODERATOR" | "SPEAKER" })[];
    }[];
  }[];
  speakers: (Speaker & { role: "CHAIR" | "CO_CHAIR" | "COMMITTEE" | "SPEAKER"; bio: string | null })[];
  partners: { level: PartnerLevel; name: string; url: string | null; logoThumbUrl: string | null }[];
  documents: Doc[];
  isPast: boolean;
  results: { text: string | null; facts: { value: string; label: string }[]; links: { title: string; url: string }[]; images: { url: string; thumbUrl: string; caption: string | null }[]; materials: Doc[] } | null;
  registration: {
    open: boolean;
    reason: string;
    taken: number;
    limit: number | null;
    showCount: boolean;
    deadline: string | null;
    formats: ParticipationFormat[];
    fields: RegistrationFields;
    specialties: { id: string; name: string }[];
  };
};

type Response = { event: PublicEvent; others: { title: string; slug: string; startDate: string; endDate: string; coverThumbUrl: string | null; city: string | null }[] };

const speakerRoles = { CHAIR: "Председатель", CO_CHAIR: "Сопредседатель", COMMITTEE: "Научный комитет", SPEAKER: "Спикер" } as const;
const closedText: Record<string, string> = {
  disabled: "Регистрация закрыта",
  deadline: "Регистрация завершена",
  started: "Регистрация завершена",
  full: "Регистрация завершена: все места заняты",
  unpublished: "Регистрация недоступна",
  archived: "Мероприятие прошло",
};
const dateFmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" });
const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" });

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

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 40, scrollMarginTop: 64 }}>
      <Typography.Title level={3}>{title}</Typography.Title>
      {children}
    </section>
  );
}

function DocList({ docs }: { docs: Doc[] }) {
  return (
    <>
      {docs.map((d) => (
        <a key={d.url} href={d.url} target="_blank" rel="noreferrer" style={{ display: "block", color: "inherit" }}>
          <Flex gap={12} align="center" style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
            <FileOutlined style={{ fontSize: 24, color: "#0B5ED7" }} />
            <div>
              <Typography.Text strong>{d.title}</Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {d.extension.toUpperCase()} · {formatSize(d.size)} · обновлён {dateFmt.format(new Date(d.fileUpdatedAt))}
                </Typography.Text>
              </div>
            </div>
          </Flex>
        </a>
      ))}
    </>
  );
}

function Program({ e }: { e: PublicEvent }) {
  const [day, setDay] = useState(e.program[0]?.id);
  const [hall, setHall] = useState("all");
  const current = e.program.find((d) => d.id === day) ?? e.program[0];
  const halls = new Map(e.halls.map((h) => [h.id, h.name]));
  const sessions = current.sessions.filter((s) => hall === "all" || !s.hallId || s.hallId === hall);
  return (
    <>
      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Segmented value={current.id} onChange={setDay} options={e.program.map((d) => ({ value: d.id, label: formatDayLabel(d.date) }))} />
        {e.halls.length > 1 && <Segmented value={hall} onChange={setHall} options={[{ value: "all", label: "Все залы" }, ...e.halls.map((h) => ({ value: h.id, label: h.name }))]} />}
      </Flex>
      {current.title && <Typography.Paragraph type="secondary">{current.title}</Typography.Paragraph>}
      {sessions.map((s) => (
        <Flex key={s.id} gap={16} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0", background: s.kind === "BREAK" ? "#FAFAFA" : undefined }}>
          <div style={{ width: 110, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
            <ClockCircleOutlined /> {s.startTime}–{s.endTime}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex gap={4} wrap style={{ marginBottom: 2 }}>
              {s.hallId && <Tag>{halls.get(s.hallId)}</Tag>}
              {s.nmo && <Tag color="blue">Учитывается для НМО</Tag>}
            </Flex>
            <Typography.Text strong={s.kind !== "BREAK"} type={s.kind === "BREAK" ? "secondary" : undefined}>
              {s.title}
            </Typography.Text>
            {s.description && <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0", fontSize: 13 }}>{s.description}</Typography.Paragraph>}
            {s.speakers.length > 0 && (
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {s.speakers.map((sp, i) => (
                  <span key={sp.id}>
                    {i > 0 && ", "}
                    {sp.fullName}
                    {sp.role === "MODERATOR" && <Typography.Text type="secondary"> (модератор)</Typography.Text>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Flex>
      ))}
    </>
  );
}

function RegistrationForm({ e }: { e: PublicEvent }) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const f = e.registration.fields;
  const send = useMutation({
    mutationFn: (v: Record<string, unknown>) => api(`/public/events/${e.slug}/registrations`, { body: v }),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["public-event", e.slug] });
    },
    onError: (err) => applyFieldErrors(form, err),
  });

  if (done) {
    return (
      <Result
        status="success"
        title="Спасибо, вы зарегистрированы"
        subTitle="Письмо-подтверждение отправлено на указанный e-mail (без SMTP — в консоль сервера). Заявка видна в админке в разделе «Регистрации»."
      />
    );
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => send.mutate(v)} disabled={send.isPending} initialValues={{ format: e.registration.formats[0] }}>
      {send.isError && <Alert type="error" showIcon title={send.error.message} style={{ marginBottom: 16 }} />}
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="Фамилия" name="lastName" rules={[{ required: true, message: "Введите фамилию" }]}>
            <Input autoComplete="family-name" maxLength={60} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Имя" name="firstName" rules={[{ required: true, message: "Введите имя" }]}>
            <Input autoComplete="given-name" maxLength={60} />
          </Form.Item>
        </Col>
        {f.middleName && (
          <Col xs={24} md={8}>
            <Form.Item label="Отчество" name="middleName">
              <Input autoComplete="additional-name" maxLength={60} />
            </Form.Item>
          </Col>
        )}
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="E-mail" name="email" rules={[{ required: true, type: "email", message: "Введите корректный e-mail" }]}>
            <Input type="email" inputMode="email" autoComplete="email" maxLength={200} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Телефон" name="phone" rules={[{ required: true, message: "Введите телефон" }]}>
            <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (900) 000-00-00" maxLength={20} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Специальность" name="specialtyId" rules={[{ required: true, message: "Выберите специальность" }]}>
            <Select showSearch={{ optionFilterProp: "label" }} options={e.registration.specialties.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Город" name="city" rules={[{ required: true, message: "Введите город" }]}>
            <Input autoComplete="address-level2" maxLength={100} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        {f.workplace && (
          <Col xs={24} md={12}>
            <Form.Item label="Место работы" name="workplace">
              <Input autoComplete="organization" maxLength={300} />
            </Form.Item>
          </Col>
        )}
        {f.position && (
          <Col xs={24} md={12}>
            <Form.Item label="Должность" name="position">
              <Input autoComplete="organization-title" maxLength={200} />
            </Form.Item>
          </Col>
        )}
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Формат участия" name="format" rules={[{ required: true, message: "Выберите формат" }]}>
            <Select options={e.registration.formats.map((v) => ({ value: v, label: participationLabels[v] }))} />
          </Form.Item>
        </Col>
        {f.snils && (
          <Col xs={24} md={12}>
            <Form.Item label="СНИЛС" name="snils" extra="Нужен для начисления баллов НМО">
              <Input inputMode="numeric" placeholder="000-000-000 00" maxLength={14} />
            </Form.Item>
          </Col>
        )}
      </Row>
      <Form.Item name="website" hidden>
        <Input tabIndex={-1} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="consentPersonalData"
        valuePropName="checked"
        rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error("Нужно согласие на обработку персональных данных"))) }]}
        style={{ marginBottom: 8 }}
      >
        <Checkbox>Я согласен на обработку персональных данных</Checkbox>
      </Form.Item>
      {f.mailingConsent && (
        <Form.Item name="consentMailing" valuePropName="checked">
          <Checkbox>Хочу получать анонсы мероприятий</Checkbox>
        </Form.Item>
      )}
      <Button type="primary" size="large" htmlType="submit" loading={send.isPending}>
        Зарегистрироваться
      </Button>
    </Form>
  );
}

export function EventPreviewPage() {
  const { slug } = useParams();
  const query = useQuery({ queryKey: ["public-event", slug], queryFn: () => api<Response>(`/public/events/${slug}`) });

  if (query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 96 }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (query.isError) return <Result status="404" title={query.error.message} subTitle="Страница показывает только опубликованные мероприятия" extra={<Link to="/preview">К тестовой главной</Link>} />;

  const { event: e, others } = query.data;
  const r = e.registration;
  const anchors = [
    { key: "about", href: "#about", title: "О мероприятии" },
    ...(e.program.length ? [{ key: "program", href: "#program", title: "Программа" }] : []),
    ...(e.speakers.length ? [{ key: "speakers", href: "#speakers", title: "Спикеры" }] : []),
    ...(e.venue.name || e.venue.address ? [{ key: "venue", href: "#venue", title: "Площадка" }] : []),
    ...(e.tariffs.length ? [{ key: "tariffs", href: "#tariffs", title: "Участие" }] : []),
    { key: "registration", href: "#registration", title: e.isPast ? "Итоги" : "Регистрация" },
    ...(e.partners.length ? [{ key: "partners", href: "#partners", title: "Партнёры" }] : []),
    ...(e.documents.length ? [{ key: "documents", href: "#documents", title: "Документы" }] : []),
  ];

  return (
    <div style={{ background: "#F3F6FA", minHeight: "100vh" }}>
      <div style={{ background: "#FFF8E1", borderBottom: "1px solid #FFE58F", padding: "8px 16px", fontSize: 13, textAlign: "center" }}>
        Тестовая страница мероприятия: данные из админки, не дизайн сайта. <Link to="/preview">Тестовая главная</Link> · <Link to="/">Админка</Link>
      </div>

      <header
        style={{
          background: e.coverUrl ? `linear-gradient(rgba(10,37,64,.75), rgba(10,37,64,.75)), url(${e.coverUrl}) center / cover` : "#0A2540",
          color: "#fff",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 16px" }}>
          <Flex gap={6} wrap style={{ marginBottom: 12 }}>
            <Tag color="blue">{formatLabels[e.format]}</Tag>
            <Tag>{modeLabels[e.attendanceMode]}</Tag>
            {e.directions.map((d) => (
              <Tag key={d}>{d}</Tag>
            ))}
            {e.nmoPoints ? <Tag color="gold">НМО: {e.nmoPoints} баллов</Tag> : null}
          </Flex>
          <Typography.Title style={{ color: "#fff", marginTop: 0 }}>{e.title}</Typography.Title>
          {e.subtitle && <Typography.Paragraph style={{ color: "#D6E6FB", fontSize: 18 }}>{e.subtitle}</Typography.Paragraph>}
          <Flex gap={32} wrap style={{ marginTop: 16 }}>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>ДАТЫ</div>
              {formatDateRange(e.startDate, e.endDate)}
            </div>
            {(e.city || e.venue.name) && (
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>МЕСТО</div>
                {[e.city, e.venue.name].filter(Boolean).join(", ")}
              </div>
            )}
            {e.expectedParticipants ? (
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>УЧАСТНИКОВ</div>
                {e.expectedParticipants}
              </div>
            ) : null}
            {!e.isPast && r.showCount && (
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>ЗАРЕГИСТРИРОВАНО</div>
                {r.taken}
                {r.limit ? ` из ${r.limit}` : ""}
              </div>
            )}
          </Flex>
          {!e.isPast && (
            <Flex gap={12} wrap style={{ marginTop: 24 }}>
              <Button type="primary" size="large" href="#registration" disabled={!r.open}>
                {r.open ? "Зарегистрироваться" : closedText[r.reason]}
              </Button>
              {e.documents[0] && (
                <Button size="large" href={e.documents[0].url} target="_blank" ghost>
                  Скачать «{e.documents[0].title}»
                </Button>
              )}
            </Flex>
          )}
        </div>
      </header>

      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px", overflowX: "auto" }}>
          <Anchor direction="horizontal" items={anchors} targetOffset={64} />
        </div>
      </div>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
        <Block id="about" title="О мероприятии">
          <Paragraphs text={e.description} />
          {!e.description && <Typography.Text type="secondary">Описание не заполнено.</Typography.Text>}
          {e.keyFacts.length > 0 && (
            <Row gutter={[16, 16]} style={{ margin: "16px 0" }}>
              {e.keyFacts.map((k, i) => (
                <Col key={i} xs={12} md={6}>
                  <Card size="small">
                    <Statistic title={k.label} value={k.value} />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
          {e.organizers && (
            <Typography.Paragraph>
              <Typography.Text type="secondary">Организаторы: </Typography.Text>
              {e.organizers}
            </Typography.Paragraph>
          )}
        </Block>

        {e.program.length > 0 && (
          <Block id="program" title="Программа">
            <Card size="small">
              <Program e={e} />
            </Card>
          </Block>
        )}

        {e.speakers.length > 0 && (
          <Block id="speakers" title="Спикеры">
            <Row gutter={[16, 16]}>
              {e.speakers.map((s) => (
                <Col key={s.id} xs={24} sm={12} lg={8}>
                  <Card size="small" style={{ height: "100%" }}>
                    <Flex gap={12}>
                      <Avatar size={64} src={s.photoThumbUrl ?? undefined} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
                      <div>
                        <Tag style={{ marginBottom: 4 }}>{speakerRoles[s.role]}</Tag>
                        <div>
                          <b>{s.fullName}</b>
                        </div>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {[s.degree, s.position].filter(Boolean).join(", ")}
                        </Typography.Text>
                      </div>
                    </Flex>
                  </Card>
                </Col>
              ))}
            </Row>
          </Block>
        )}

        {(e.venue.name || e.venue.address) && (
          <Block id="venue" title="Площадка">
            <Card size="small">
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {e.venue.name}
              </Typography.Title>
              {e.venue.address && <Typography.Paragraph>{e.venue.address}</Typography.Paragraph>}
              {e.venue.howToGet && (
                <>
                  <Typography.Text strong>Как добраться</Typography.Text>
                  <Paragraphs text={e.venue.howToGet} />
                </>
              )}
              {e.venue.parking && (
                <>
                  <Typography.Text strong>Парковка</Typography.Text>
                  <Paragraphs text={e.venue.parking} />
                </>
              )}
              {e.venue.accommodation && (
                <>
                  <Typography.Text strong>Проживание</Typography.Text>
                  <Paragraphs text={e.venue.accommodation} />
                </>
              )}
              {e.venue.lat !== null && e.venue.lng !== null ? (
                <a href={`https://yandex.ru/maps/?pt=${e.venue.lng},${e.venue.lat}&z=16&l=map`} target="_blank" rel="noreferrer">
                  Открыть на Яндекс.Картах ({e.venue.lat}, {e.venue.lng})
                </a>
              ) : (
                <Typography.Text type="secondary">Координаты для карты не заданы.</Typography.Text>
              )}
            </Card>
          </Block>
        )}

        {e.tariffs.length > 0 && (
          <Block id="tariffs" title="Условия участия">
            <Row gutter={[16, 16]}>
              {e.tariffs.map((t, i) => (
                <Col key={i} xs={24} sm={12} lg={6}>
                  <Card size="small" style={{ height: "100%" }}>
                    <Typography.Text strong>{t.name}</Typography.Text>
                    {t.audience && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {t.audience}
                        </Typography.Text>
                      </div>
                    )}
                    <Typography.Title level={4} style={{ margin: "8px 0" }}>
                      {t.price ? `${t.price.toLocaleString("ru-RU")} ₽` : "Бесплатно"}
                    </Typography.Title>
                    {t.includes && (
                      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13 }}>
                        {t.includes.split("\n").filter(Boolean).map((l, j) => (
                          <li key={j}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </Block>
        )}

        <Block id="registration" title={e.isPast ? "Итоги" : "Регистрация"}>
          {e.isPast && e.results ? (
            <Card size="small">
              <Paragraphs text={e.results.text} />
              {e.results.facts.length > 0 && (
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  {e.results.facts.map((k, i) => (
                    <Col key={i} xs={12} md={6}>
                      <Statistic title={k.label} value={k.value} />
                    </Col>
                  ))}
                </Row>
              )}
              {e.results.images.length > 0 && (
                <Image.PreviewGroup>
                  <Flex gap={8} wrap style={{ marginBottom: 16 }}>
                    {e.results.images.map((img) => (
                      <Image key={img.url} src={img.thumbUrl} preview={{ src: img.url }} width={180} height={135} style={{ objectFit: "cover", borderRadius: 6 }} alt={img.caption ?? ""} />
                    ))}
                  </Flex>
                </Image.PreviewGroup>
              )}
              {e.results.links.map((l) => (
                <div key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.title}
                  </a>
                </div>
              ))}
              {e.results.materials.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: 16 }}>
                    Материалы докладов
                  </Typography.Title>
                  <DocList docs={e.results.materials} />
                </>
              )}
              {!e.results.text && !e.results.facts.length && !e.results.images.length && !e.results.materials.length && (
                <Empty description="Итоги ещё не опубликованы" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          ) : r.open ? (
            <Card size="small">
              {r.deadline && <Typography.Paragraph type="secondary">Регистрация открыта до {dateTime.format(new Date(r.deadline))}</Typography.Paragraph>}
              <RegistrationForm e={e} />
            </Card>
          ) : (
            <Alert type="info" showIcon title={closedText[r.reason]} />
          )}
        </Block>

        {e.partners.length > 0 && (
          <Block id="partners" title="Партнёры">
            {levels.map((lvl) => {
              const items = e.partners.filter((p) => p.level === lvl);
              if (!items.length) return null;
              return (
                <div key={lvl} style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary">{levelLabels[lvl]}</Typography.Text>
                  <Flex gap={12} wrap style={{ marginTop: 8 }}>
                    {items.map((p) => {
                      const box = (
                        <div style={{ width: lvl === "GENERAL" ? 220 : 160, height: lvl === "GENERAL" ? 110 : 80, background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, display: "grid", placeItems: "center", padding: 8 }}>
                          {p.logoThumbUrl ? <img src={p.logoThumbUrl} alt={p.name} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : p.name}
                        </div>
                      );
                      return p.url ? (
                        <a key={p.name} href={p.url} target="_blank" rel="noreferrer" title={p.name}>
                          {box}
                        </a>
                      ) : (
                        <div key={p.name}>{box}</div>
                      );
                    })}
                  </Flex>
                </div>
              );
            })}
          </Block>
        )}

        {e.documents.length > 0 && (
          <Block id="documents" title="Документы">
            <Card size="small">
              <DocList docs={e.documents} />
            </Card>
          </Block>
        )}

        {others.length > 0 && (
          <Block id="others" title="Другие мероприятия">
            <Row gutter={[16, 16]}>
              {others.map((o) => (
                <Col key={o.slug} xs={24} md={8}>
                  <Link to={`/preview/events/${o.slug}`}>
                    <Card size="small" hoverable cover={o.coverThumbUrl ? <img src={o.coverThumbUrl} alt="" style={{ aspectRatio: "16 / 9", objectFit: "cover" }} /> : undefined}>
                      <Typography.Text strong>{o.title}</Typography.Text>
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {formatDateRange(o.startDate, o.endDate)}
                          {o.city ? ` · ${o.city}` : ""}
                        </Typography.Text>
                      </div>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          </Block>
        )}
      </main>
    </div>
  );
}
