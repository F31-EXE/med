import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Avatar, Button, Card, Empty, Flex, Select, Space, Spin, Typography } from "antd";
import { DeleteOutlined, UserAddOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { SortableList } from "../../components/SortableList";
import { SpeakerFormModal } from "../speakers/SpeakerFormModal";
import { SpeakerSelect } from "../speakers/SpeakerSelect";
import { speakerCaption, type SpeakerBrief } from "../speakers/speakerTypes";
import { EventShell } from "./EventTabs";

type Role = "CHAIR" | "CO_CHAIR" | "COMMITTEE" | "SPEAKER";
type Row = { speakerId: string; role: Role; speaker: SpeakerBrief };

const roleLabels: Record<Role, string> = {
  CHAIR: "Председатель",
  CO_CHAIR: "Сопредседатель",
  COMMITTEE: "Научный комитет",
  SPEAKER: "Спикер",
};
const roleOptions = (Object.keys(roleLabels) as Role[]).map((value) => ({ value, label: roleLabels[value] }));

export function EventSpeakersPage() {
  const { id } = useParams();
  return <EventShell id={id!} active="speakers">{(event) => <EventSpeakersEditor eventId={id!} readOnly={event.state === "deleted"} />}</EventShell>;
}

function EventSpeakersEditor({ eventId, readOnly }: { eventId: string; readOnly: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["event-speakers", eventId],
    queryFn: () => api<{ speakers: Row[]; programSpeakers: SpeakerBrief[] }>(`/events/${eventId}/speakers`),
  });

  useEffect(() => {
    if (query.data && !dirty) setRows(query.data.speakers);
  }, [query.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      api(`/events/${eventId}/speakers`, { method: "PUT", body: { speakers: rows.map(({ speakerId, role }) => ({ speakerId, role })) } }),
    onSuccess: () => {
      message.success("Список спикеров сохранён");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["event-speakers", eventId] });
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
    },
    onError: (e) => message.error(e.message),
  });

  function change(next: Row[]) {
    setRows(next);
    setDirty(true);
  }

  function addSpeaker(speaker: SpeakerBrief, role: Role = "SPEAKER") {
    if (rows.some((r) => r.speakerId === speaker.id)) return;
    change([...rows, { speakerId: speaker.id, role, speaker }]);
  }

  if (query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }
  if (query.isError) return <Typography.Text type="danger">{query.error.message}</Typography.Text>;

  const missingFromProgram = query.data.programSpeakers.filter((s) => !rows.some((r) => r.speakerId === s.id));

  return (
    <>
      <Typography.Paragraph type="secondary">
        Блок «Спикеры» на странице мероприятия: председатели, научный комитет и докладчики в нужном порядке. Порядок меняется перетаскиванием.
      </Typography.Paragraph>

      {!readOnly && missingFromProgram.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`В программе есть спикеры, которых нет в этом списке: ${missingFromProgram.length}`}
          description={missingFromProgram.map((s) => s.fullName).join(", ")}
          action={
            <Button size="small" onClick={() => change([...rows, ...missingFromProgram.map((s) => ({ speakerId: s.id, role: "SPEAKER" as Role, speaker: s }))])}>
              Добавить всех
            </Button>
          }
        />
      )}

      <Card size="small">
        {!readOnly && (
          <Flex gap={8} wrap style={{ marginBottom: 12 }}>
            <SpeakerSelect
              value={undefined}
              exclude={rows.map((r) => r.speakerId)}
              onChange={(_id, s) => addSpeaker(s)}
              placeholder="Добавить спикера: начните вводить фамилию"
              style={{ flex: "1 1 280px", minWidth: 0 }}
            />
            <Button icon={<UserAddOutlined />} onClick={() => setCreating(true)}>
              Новый спикер
            </Button>
          </Flex>
        )}

        {rows.length === 0 ? (
          <Empty description="Спикеры не добавлены — блок на странице будет скрыт" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <SortableList
            items={rows}
            getId={(r) => r.speakerId}
            disabled={readOnly}
            onReorder={change}
            renderItem={(r, handle) => (
              <Flex align="center" gap={8} wrap style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
                {handle}
                <Avatar src={r.speaker.photoThumbUrl ?? undefined} icon={<UserOutlined />} />
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div>{r.speaker.fullName}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {speakerCaption(r.speaker) || "—"}
                  </Typography.Text>
                </div>
                <Space>
                  <Select
                    value={r.role}
                    options={roleOptions}
                    disabled={readOnly}
                    onChange={(role: Role) => change(rows.map((x) => (x.speakerId === r.speakerId ? { ...x, role } : x)))}
                    style={{ width: 180 }}
                  />
                  {!readOnly && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => change(rows.filter((x) => x.speakerId !== r.speakerId))}
                      aria-label="Убрать из списка"
                    />
                  )}
                </Space>
              </Flex>
            )}
          />
        )}
      </Card>

      {!readOnly && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#fff", borderTop: "1px solid #f0f0f0", padding: "12px 16px", margin: "16px -16px 0" }}>
          <Space wrap>
            <Button type="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
              Сохранить
            </Button>
            {dirty && (
              <>
                <Button type="text" onClick={() => setDirty(false)}>
                  Отменить изменения
                </Button>
                <Typography.Text type="warning">Есть несохранённые изменения</Typography.Text>
              </>
            )}
          </Space>
        </div>
      )}

      <SpeakerFormModal open={creating} onClose={() => setCreating(false)} onSaved={(s) => addSpeaker(s)} />
    </>
  );
}
