import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button, Card, Flex, Grid, Input, Pagination, Segmented, Select, Spin, Typography } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { EventSelect } from "../../components/EventSelect";
import { DocumentFormModal } from "./DocumentFormModal";
import { DocumentList } from "./DocumentList";
import { useSvedenSections } from "./documentsApi";
import type { DocumentItem } from "./documentTypes";

type View = "all" | "event" | "section" | "unplaced";

export function DocumentsPage() {
  const screens = Grid.useBreakpoint();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [editing, setEditing] = useState<DocumentItem | "new" | null>(null);
  const sections = useSvedenSections();

  const view = (params.get("view") as View) || "all";
  const eventId = params.get("eventId") ?? undefined;
  const section = params.get("section") ?? undefined;
  const page = Number(params.get("page") || 1);

  function update(patch: Record<string, string | number | undefined | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ page: String(page) });
  if (params.get("q")) query.set("q", params.get("q")!);
  if (view === "event" && eventId) {
    query.set("eventId", eventId);
    query.set("eventSection", "MAIN");
  }
  if (view === "section" && section) query.set("section", section);
  if (view === "unplaced") query.set("unplaced", "true");
  const waiting = (view === "event" && !eventId) || (view === "section" && !section);

  const list = useQuery({
    queryKey: ["documents", "list", query.toString()],
    queryFn: () => api<{ items: DocumentItem[]; total: number; pageSize: number }>(`/documents?${query.toString()}`),
    placeholderData: keepPreviousData,
    enabled: !waiting,
  });

  const sortScope =
    !params.get("q") && view === "event" && eventId
      ? { scope: "event" as const, key: eventId, eventSection: "MAIN" as const }
      : !params.get("q") && view === "section" && section
        ? { scope: "section" as const, key: section }
        : undefined;

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Документы
        </Typography.Title>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setEditing("new")}>
          Загрузить документ
        </Button>
      </Flex>

      <Segmented<View>
        value={view}
        onChange={(v) => update({ view: v === "all" ? undefined : v, eventId: undefined, section: undefined })}
        options={[
          { value: "all", label: "Все" },
          { value: "event", label: "Мероприятия" },
          { value: "section", label: "Сведения об образовательной организации" },
          { value: "unplaced", label: "Не размещены" },
        ]}
        style={{ marginBottom: 16, maxWidth: "100%", overflowX: "auto" }}
      />

      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        {view === "event" && (
          <div style={{ width: screens.md ? 480 : "100%" }}>
            <EventSelect value={eventId} onChange={(v) => update({ eventId: v })} placeholder="Выберите мероприятие" />
          </div>
        )}
        {view === "section" && (
          <Select
            placeholder="Выберите подраздел"
            value={section}
            onChange={(v) => update({ section: v })}
            options={sections.data?.map((s) => ({ value: s.key, label: `${s.title}${s.count ? ` · ${s.count}` : ""}` }))}
            style={{ width: screens.md ? 480 : "100%" }}
            popupMatchSelectWidth={false}
          />
        )}
        <Input.Search
          placeholder="Название или имя файла"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(q) => update({ q })}
          style={{ width: screens.md ? 280 : "100%" }}
        />
      </Flex>

      {view === "section" && section && (
        <Typography.Paragraph type="secondary">
          Адрес подраздела на сайте: <Typography.Text code>/sveden/{section}/</Typography.Text>. Порядок документов меняется перетаскиванием.
        </Typography.Paragraph>
      )}
      {view === "event" && eventId && (
        <Typography.Paragraph type="secondary">
          Порядок документов на странице мероприятия меняется перетаскиванием. Материалы докладов — на вкладке мероприятия «Итоги».
        </Typography.Paragraph>
      )}

      <Card size="small">
        {waiting ? (
          <Typography.Text type="secondary">{view === "event" ? "Выберите мероприятие" : "Выберите подраздел"}</Typography.Text>
        ) : list.isPending ? (
          <Flex justify="center" style={{ padding: 32 }}>
            <Spin />
          </Flex>
        ) : list.isError ? (
          <Typography.Text type="danger">{list.error.message}</Typography.Text>
        ) : (
          <DocumentList
            items={list.data.items}
            sortScope={sortScope}
            showPlacement={view === "all" || view === "unplaced"}
            onEdit={setEditing}
          />
        )}
      </Card>

      {!waiting && list.data && list.data.total > list.data.pageSize && (
        <Pagination
          current={page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          onChange={(p) => update({ page: p === 1 ? undefined : p })}
          showSizeChanger={false}
          style={{ marginTop: 16, textAlign: "right" }}
        />
      )}

      <DocumentFormModal
        open={editing !== null}
        document={editing === "new" ? null : editing}
        defaults={{ eventId: view === "event" ? eventId : null, svedenSection: view === "section" ? section : null }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
