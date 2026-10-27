import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Flex, Spin, Typography } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { DocumentFormModal } from "../documents/DocumentFormModal";
import { DocumentList } from "../documents/DocumentList";
import type { DocumentItem } from "../documents/documentTypes";
import { EventShell } from "./EventTabs";

export function EventDocumentsPage() {
  const { id } = useParams();
  return <EventShell id={id!} active="documents">{(event) => <EventDocuments eventId={id!} readOnly={event.state === "deleted"} />}</EventShell>;
}

function EventDocuments({ eventId, readOnly }: { eventId: string; readOnly: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DocumentItem | "new" | null>(null);

  const list = useQuery({
    queryKey: ["documents", "list", `eventId=${eventId}`],
    queryFn: () => api<{ items: DocumentItem[] }>(`/documents?eventId=${eventId}`),
  });

  const unplace = useMutation({
    mutationFn: (doc: DocumentItem) =>
      api(`/documents/${doc.id}`, {
        method: "PUT",
        body: { title: doc.title, description: doc.description, eventId: null, svedenSection: doc.svedenSection },
      }),
    onSuccess: () => {
      message.success("Документ убран со страницы мероприятия. Он остался в разделе «Документы»");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary">
          Блок «Документы» на странице мероприятия: программа, информационное письмо, требования к тезисам, спонсорские пакеты. Порядок — перетаскиванием.
        </Typography.Text>
        {!readOnly && (
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setEditing("new")}>
            Загрузить документ
          </Button>
        )}
      </Flex>
      <Card size="small">
        {list.isPending ? (
          <Flex justify="center" style={{ padding: 32 }}>
            <Spin />
          </Flex>
        ) : list.isError ? (
          <Typography.Text type="danger">{list.error.message}</Typography.Text>
        ) : (
          <DocumentList
            items={list.data.items}
            sortScope={{ scope: "event", key: eventId }}
            showPlacement={false}
            readOnly={readOnly}
            onEdit={setEditing}
            onUnplace={(doc) => unplace.mutate(doc)}
          />
        )}
      </Card>
      <DocumentFormModal open={editing !== null} document={editing === "new" ? null : editing} defaults={{ eventId }} onClose={() => setEditing(null)} />
    </>
  );
}
