import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Flex, Progress, Row, Spin, Statistic, Tag, Typography } from "antd";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { roleLabels } from "../auth/roles";
import { colors } from "../theme";
import { formatDateRange } from "./events/eventTypes";
import { availabilityLabels, type AvailabilityReason } from "./registrations/registrationTypes";

type DashboardEvent = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  startDate: string;
  endDate: string;
  city: string | null;
  daysLeft: number;
  availability: { open: boolean; reason: AvailabilityReason; taken: number; limit: number | null };
  warnings: string[];
};

type Dashboard = {
  events: DashboardEvent[];
  registrations: { newTotal: number; last24h: number; byEvent: { eventId: string; title: string; count: number }[] } | null;
  content: {
    scheduledNews: { id: string; title: string; publishAt: string }[];
    draftNews: number;
    emptyPages: { key: string; title: string }[];
    pagesWithoutSeo: number;
  } | null;
};

const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

function daysLabel(n: number) {
  if (n <= 0) return "идёт сейчас";
  if (n === 1) return "завтра";
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "день" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "дня" : "дней";
  return `через ${n} ${word}`;
}

function Block({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} extra={extra} size="small" style={{ height: "100%" }}>
      {children}
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard"), refetchInterval: 60 * 1000 });
  const seesContent = user?.role === "ADMIN" || user?.role === "EDITOR";

  return (
    <>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Здравствуйте, {user?.name}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{user && roleLabels[user.role]}</Typography.Paragraph>

      {query.isPending ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : query.isError ? (
        <Typography.Text type="danger">{query.error.message}</Typography.Text>
      ) : (
        <Row gutter={[16, 16]}>
          {query.data.registrations && (
            <>
              <Col xs={12} md={6}>
                <Card size="small" variant="borderless" style={{ background: colors.mintSoft, boxShadow: "none", height: "100%" }}>
                  <Link to="/registrations?status=NEW" style={{ color: "inherit" }}>
                    <Statistic title="Новые заявки" value={query.data.registrations.newTotal} />
                  </Link>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" variant="borderless" style={{ background: colors.skySoft, boxShadow: "none", height: "100%" }}>
                  <Statistic title="Заявок за сутки" value={query.data.registrations.last24h} />
                </Card>
              </Col>
            </>
          )}
          {query.data.content && (
            <>
              <Col xs={12} md={6}>
                <Card size="small" variant="borderless" style={{ background: colors.peachSoft, boxShadow: "none", height: "100%" }}>
                  <Link to="/news?tab=scheduled" style={{ color: "inherit" }}>
                    <Statistic title="Новостей запланировано" value={query.data.content.scheduledNews.length} />
                  </Link>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" variant="borderless" style={{ background: colors.lavSoft, boxShadow: "none", height: "100%" }}>
                  <Link to="/pages" style={{ color: "inherit" }}>
                    <Statistic title="Страниц без SEO" value={query.data.content.pagesWithoutSeo} />
                  </Link>
                </Card>
              </Col>
            </>
          )}

          <Col xs={24} lg={query.data.registrations ? 14 : 24}>
            <Block title="Ближайшие мероприятия" extra={<Link to="/events">Все</Link>}>
              {query.data.events.length === 0 ? (
                <Empty description="Предстоящих мероприятий нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                query.data.events.map((e) => {
                  const { taken, limit, reason } = e.availability;
                  return (
                    <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
                      <Flex justify="space-between" gap={8} wrap>
                        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                          <Link to={seesContent ? `/events/${e.id}` : `/registrations?eventId=${e.id}`}>{e.title}</Link>
                          <div>
                            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                              {formatDateRange(e.startDate, e.endDate)}
                              {e.city ? ` · ${e.city}` : ""} · {daysLabel(e.daysLeft)}
                            </Typography.Text>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 150 }}>
                          <Typography.Text style={{ fontSize: 13 }}>
                            Заявок: <b>{taken}</b>
                            {limit !== null ? ` из ${limit}` : ""}
                          </Typography.Text>
                          {limit !== null && (
                            <Progress percent={Math.min(100, Math.round((taken / limit) * 100))} size="small" showInfo={false} status={taken >= limit ? "exception" : "normal"} />
                          )}
                          <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                            {availabilityLabels[reason]}
                          </Typography.Text>
                        </div>
                      </Flex>
                      {e.warnings.length > 0 && (
                        <Flex gap={4} wrap style={{ marginTop: 6 }}>
                          {e.warnings.map((w) => (
                            <Tag key={w} color="warning" style={{ margin: 0 }}>
                              {w}
                            </Tag>
                          ))}
                        </Flex>
                      )}
                    </div>
                  );
                })
              )}
            </Block>
          </Col>

          {query.data.registrations && (
            <Col xs={24} lg={10}>
              <Block title="Необработанные заявки" extra={<Link to="/registrations?status=NEW">Открыть</Link>}>
                {query.data.registrations.byEvent.length === 0 ? (
                  <Empty description="Все заявки обработаны" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  query.data.registrations.byEvent.map((r) => (
                    <Link key={r.eventId} to={`/registrations?eventId=${r.eventId}&status=NEW`} style={{ color: "inherit", display: "block" }}>
                      <Flex justify="space-between" gap={8} style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <Typography.Text ellipsis style={{ flex: 1 }}>
                          {r.title}
                        </Typography.Text>
                        <Tag color="processing" style={{ margin: 0 }}>
                          {r.count}
                        </Tag>
                      </Flex>
                    </Link>
                  ))
                )}
              </Block>
            </Col>
          )}

          {query.data.content && (
            <>
              <Col xs={24} md={12}>
                <Block title="Запланированные новости" extra={<Link to="/news?tab=scheduled">Все</Link>}>
                  {query.data.content.scheduledNews.length === 0 ? (
                    <Empty description="Нет запланированных публикаций" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    query.data.content.scheduledNews.map((n) => (
                      <Flex key={n.id} justify="space-between" gap={8} wrap style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <Link to={`/news/${n.id}`} style={{ flex: "1 1 200px", minWidth: 0 }}>
                          {n.title}
                        </Link>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {dateTime.format(new Date(n.publishAt))}
                        </Typography.Text>
                      </Flex>
                    ))
                  )}
                  {query.data.content.draftNews > 0 && (
                    <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0", fontSize: 13 }}>
                      Черновиков: <Link to="/news?tab=draft">{query.data.content.draftNews}</Link>
                    </Typography.Paragraph>
                  )}
                </Block>
              </Col>
              <Col xs={24} md={12}>
                <Block title="Незаполненные страницы" extra={<Link to="/pages">Все страницы</Link>}>
                  {query.data.content.emptyPages.length === 0 ? (
                    <Empty description="Все страницы заполнены" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <>
                      {query.data.content.emptyPages.slice(0, 6).map((p) => (
                        <Link key={p.key} to={`/pages/${p.key}`} style={{ display: "block", padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                          {p.title}
                        </Link>
                      ))}
                      {query.data.content.emptyPages.length > 6 && (
                        <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0", fontSize: 13 }}>
                          и ещё {query.data.content.emptyPages.length - 6}
                        </Typography.Paragraph>
                      )}
                    </>
                  )}
                </Block>
              </Col>
            </>
          )}
        </Row>
      )}
    </>
  );
}

export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <>
      <Typography.Title level={2}>{title}</Typography.Title>
      <Card>
        <Typography.Text type="secondary">Раздел в разработке.</Typography.Text>
      </Card>
    </>
  );
}
