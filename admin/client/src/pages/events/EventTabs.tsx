import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Flex, Result, Spin, Tabs, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import type { EventDetail } from "./eventTypes";
import { StatusTags } from "./EventsListPage";

export type EventTabKey = "main" | "program" | "speakers";

const paths: Record<EventTabKey, string> = { main: "", program: "/program", speakers: "/speakers" };

export function EventTabs({ id, active }: { id?: string; active: EventTabKey }) {
  const navigate = useNavigate();
  return (
    <Tabs
      activeKey={active}
      onChange={(key) => navigate(`/events/${id}${paths[key as EventTabKey]}`)}
      items={[
        { key: "main", label: "Основное" },
        { key: "program", label: "Программа", disabled: !id },
        { key: "speakers", label: "Спикеры", disabled: !id },
      ]}
      style={{ marginBottom: 8 }}
    />
  );
}

export function useEventDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: () => api<{ event: EventDetail }>(`/events/${id}`).then((r) => r.event),
    enabled: !!id,
  });
}

export function EventShell({ id, active, children }: { id: string; active: EventTabKey; children: (event: EventDetail) => ReactNode }) {
  const query = useEventDetail(id);
  if (query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 64 }}>
        <Spin size="large" />
      </Flex>
    );
  }
  if (query.isError) {
    return <Result status="error" title={query.error.message} extra={<Link to="/events">К списку мероприятий</Link>} />;
  }
  const event = query.data;
  return (
    <div style={{ maxWidth: 1000 }}>
      <Link to="/events" style={{ display: "inline-block", marginBottom: 8 }}>
        <ArrowLeftOutlined /> Мероприятия
      </Link>
      <Typography.Title level={2} style={{ margin: 0 }}>
        {event.title}
      </Typography.Title>
      <div style={{ margin: "8px 0 8px" }}>
        <StatusTags item={event} />
      </div>
      <EventTabs id={id} active={active} />
      {event.state === "deleted" && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Мероприятие в корзине — изменения недоступны. Восстановите его на вкладке «Основное»." />
      )}
      {children(event)}
    </div>
  );
}
