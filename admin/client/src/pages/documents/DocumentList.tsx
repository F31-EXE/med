import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Dropdown, Empty, Flex, Space, Tag, Tooltip, Typography, Upload } from "antd";
import { CopyOutlined, DeleteOutlined, EditOutlined, MoreOutlined, SwapOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { SortableList } from "../../components/SortableList";
import { sendDocument } from "./documentsApi";
import { ACCEPT, MAX_SIZE, absoluteUrl, formatSize, typeColors, type DocumentItem } from "./documentTypes";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" });

type Props = {
  items: DocumentItem[];
  sortScope?: { scope: "event" | "section"; key: string };
  showPlacement?: boolean;
  onEdit: (doc: DocumentItem) => void;
  onUnplace?: (doc: DocumentItem) => void;
  readOnly?: boolean;
};

function TypeBadge({ ext }: { ext: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 52,
        borderRadius: 6,
        background: typeColors[ext] ?? "#8c8c8c",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        letterSpacing: 0.5,
      }}
    >
      {ext.toUpperCase()}
    </div>
  );
}

export function DocumentList({ items, sortScope, showPlacement = true, onEdit, onUnplace, readOnly }: Props) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [replacing, setReplacing] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["documents"] });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api(`/documents/order/${sortScope!.scope}`, { method: "PUT", body: { key: sortScope!.key, ids } }),
    onError: (e) => {
      message.error(e.message);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      message.success("Документ удалён");
      refresh();
    },
    onError: (e) => message.error(e.message),
  });

  async function replace(doc: DocumentItem, file: File) {
    if (file.size > MAX_SIZE) return message.error("Файл больше 20 МБ");
    setReplacing(doc.id);
    try {
      await sendDocument(`/documents/${doc.id}/file`, file);
      message.success("Файл заменён. Ссылка осталась прежней");
      refresh();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setReplacing(null);
    }
  }

  async function copy(doc: DocumentItem) {
    try {
      await navigator.clipboard.writeText(absoluteUrl(doc.url));
      message.success("Ссылка скопирована");
    } catch {
      modal.info({ title: "Ссылка на документ", content: <Typography.Text copyable>{absoluteUrl(doc.url)}</Typography.Text> });
    }
  }

  if (items.length === 0) return <Empty description="Документов нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const row = (doc: DocumentItem, handle: ReactNode) => (
    <Flex align="center" gap={12} style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
      {handle}
      <TypeBadge ext={doc.extension} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }}>
          {doc.title}
        </a>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {doc.originalName} · {formatSize(doc.size)} · обновлён {dateFmt.format(new Date(doc.fileUpdatedAt))}
          </Typography.Text>
        </div>
        {doc.description && (
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ margin: 0, fontSize: 13 }}>
            {doc.description}
          </Typography.Paragraph>
        )}
        {showPlacement && (doc.event || doc.sectionTitle) && (
          <Space size={4} wrap style={{ marginTop: 4 }}>
            {doc.event && (
              <Tag color="blue">
                <Link to={`/events/${doc.event.id}/documents`}>{doc.event.title}</Link>
              </Tag>
            )}
            {doc.sectionTitle && <Tag color="purple">Сведения: {doc.sectionTitle}</Tag>}
          </Space>
        )}
        {showPlacement && !doc.event && !doc.sectionTitle && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Не размещён — доступен только по ссылке
          </Typography.Text>
        )}
      </div>
      <Space size={4}>
        <Tooltip title="Скопировать ссылку">
          <Button type="text" icon={<CopyOutlined />} onClick={() => copy(doc)} aria-label="Скопировать ссылку" />
        </Tooltip>
        {!readOnly && (
          <>
            <Upload accept={ACCEPT} showUploadList={false} beforeUpload={(f) => (replace(doc, f), false)} disabled={!!replacing}>
              <Tooltip title="Заменить файл (ссылка не изменится)">
                <Button type="text" icon={<SwapOutlined />} loading={replacing === doc.id} aria-label="Заменить файл" />
              </Tooltip>
            </Upload>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "edit", icon: <EditOutlined />, label: "Изменить" },
                  ...(onUnplace ? [{ key: "unplace", label: "Убрать со страницы" }] : []),
                  { type: "divider" as const },
                  { key: "delete", icon: <DeleteOutlined />, label: "Удалить", danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === "edit") onEdit(doc);
                  if (key === "unplace") onUnplace?.(doc);
                  if (key === "delete") {
                    modal.confirm({
                      title: "Удалить документ?",
                      content: "Файл удалится с сервера, ссылка на него перестанет работать. Если документ нужен в другом месте, лучше уберите его со страницы.",
                      okText: "Удалить",
                      okButtonProps: { danger: true },
                      cancelText: "Отмена",
                      onOk: () => remove.mutateAsync(doc.id),
                    });
                  }
                },
              }}
            >
              <Button type="text" icon={<MoreOutlined />} aria-label="Действия" />
            </Dropdown>
          </>
        )}
      </Space>
    </Flex>
  );

  if (sortScope && !readOnly) {
    return (
      <SortableList
        items={items}
        getId={(d) => d.id}
        onReorder={(next) => {
          queryClient.setQueriesData<{ items: DocumentItem[] }>({ queryKey: ["documents", "list"] }, (old) =>
            old && old.items.length === next.length && old.items.every((i) => next.some((n) => n.id === i.id)) ? { ...old, items: next } : old,
          );
          reorder.mutate(next.map((d) => d.id));
        }}
        renderItem={row}
      />
    );
  }
  return <>{items.map((d) => <div key={d.id}>{row(d, null)}</div>)}</>;
}

