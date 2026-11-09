import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, AutoComplete, Button, Card, Empty, Flex, Select, Space, Spin, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { SortableList } from "../../components/SortableList";
import { PartnerFormModal } from "../partners/PartnerFormModal";
import { PartnerLogo } from "../partners/PartnerLogo";
import { PartnerSelect } from "../partners/PartnerSelect";
import { hostOf, levelLabels, levelShort, levels, type PartnerBrief, type PartnerLevel } from "../partners/partnerTypes";
import { EventShell } from "./EventTabs";

type Row = { partnerId: string; level: PartnerLevel; groupTitle: string | null; partner: PartnerBrief };

const levelOptions = levels.map((value) => ({ value, label: levelShort[value] }));

export function EventPartnersPage() {
  const { id } = useParams();
  return <EventShell id={id!} active="partners">{(event) => <EventPartners eventId={id!} readOnly={event.state === "deleted"} />}</EventShell>;
}

function EventPartners({ eventId, readOnly }: { eventId: string; readOnly: boolean }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [creatingFor, setCreatingFor] = useState<PartnerLevel | null>(null);

  const query = useQuery({
    queryKey: ["event-partners", eventId],
    queryFn: () => api<{ partners: Row[] }>(`/events/${eventId}/partners`).then((r) => r.partners),
  });

  useEffect(() => {
    if (query.data && !dirty) setRows(query.data);
  }, [query.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      api(`/events/${eventId}/partners`, {
        method: "PUT",
        body: { partners: levels.flatMap((l) => rows.filter((r) => r.level === l)).map(({ partnerId, level, groupTitle }) => ({ partnerId, level, groupTitle })) },
      }),
    onSuccess: () => {
      message.success("Партнёры мероприятия сохранены");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["event-partners", eventId] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (e) => message.error(e.message),
  });

  function change(next: Row[]) {
    setRows(next);
    setDirty(true);
  }

  function add(partner: PartnerBrief, level: PartnerLevel) {
    if (rows.some((r) => r.partnerId === partner.id)) return;
    change([...rows, { partnerId: partner.id, level, groupTitle: null, partner }]);
  }

  const groupOptions = [...new Set(rows.map((r) => r.groupTitle).filter((g): g is string => !!g?.trim()))].map((value) => ({ value }));

  if (query.isPending) {
    return (
      <Flex justify="center" style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }
  if (query.isError) return <Typography.Text type="danger">{query.error.message}</Typography.Text>;

  const taken = rows.map((r) => r.partnerId);

  return (
    <>
      <Typography.Paragraph type="secondary">
        Блок «Партнёры» на странице мероприятия. Логотипы выводятся по уровням в указанном порядке; порядок внутри уровня — перетаскиванием. Чтобы разбить уровень на группы со своими заголовками (например, «Титульные спонсоры», «Участники выставки»), заполните у партнёров поле заголовка — пустое поле означает название уровня.
      </Typography.Paragraph>

      {levels.map((level) => {
        const items = rows.filter((r) => r.level === level);
        return (
          <Card key={level} size="small" title={`${levelLabels[level]}${items.length ? ` · ${items.length}` : ""}`} style={{ marginBottom: 16 }}>
            {items.length === 0 ? (
              <Empty description="Не указаны — уровень на сайте будет скрыт" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: "8px 0" }} />
            ) : (
              <SortableList
                items={items}
                getId={(r) => r.partnerId}
                disabled={readOnly}
                onReorder={(next) => change([...rows.filter((r) => r.level !== level), ...next])}
                renderItem={(r, handle) => (
                  <Flex align="center" gap={12} wrap style={{ padding: "8px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
                    {handle}
                    <PartnerLogo partner={r.partner} />
                    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                      {r.partner.name}
                      {r.partner.url && (
                        <div>
                          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                            {hostOf(r.partner.url)}
                          </Typography.Text>
                        </div>
                      )}
                    </div>
                    <Space wrap>
                      <AutoComplete
                        value={r.groupTitle ?? ""}
                        options={groupOptions}
                        disabled={readOnly}
                        placeholder={levelLabels[r.level]}
                        onChange={(v: string) => change(rows.map((x) => (x.partnerId === r.partnerId ? { ...x, groupTitle: v.trim() ? v : null } : x)))}
                        filterOption={(input, o) => String(o?.value ?? "").toLowerCase().includes(input.toLowerCase())}
                        style={{ width: 220 }}
                        aria-label="Заголовок группы на сайте"
                      />
                      <Select
                        value={r.level}
                        options={levelOptions}
                        disabled={readOnly}
                        onChange={(next: PartnerLevel) =>
                          change([...rows.filter((x) => x.partnerId !== r.partnerId), { ...r, level: next }])
                        }
                        style={{ width: 170 }}
                        aria-label="Уровень"
                      />
                      {!readOnly && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => change(rows.filter((x) => x.partnerId !== r.partnerId))}
                          aria-label="Убрать партнёра"
                        />
                      )}
                    </Space>
                  </Flex>
                )}
              />
            )}
            {!readOnly && (
              <Flex gap={8} wrap style={{ marginTop: 12 }}>
                <PartnerSelect exclude={taken} onChange={(p) => add(p, level)} style={{ flex: "1 1 260px", minWidth: 0 }} />
                <Button icon={<PlusOutlined />} onClick={() => setCreatingFor(level)}>
                  Новый партнёр
                </Button>
              </Flex>
            )}
          </Card>
        );
      })}

      {!readOnly && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#fff", borderTop: "1px solid #f0f0f0", padding: "12px 16px", margin: "0 -16px" }}>
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

      <PartnerFormModal
        open={creatingFor !== null}
        partner={null}
        onClose={() => setCreatingFor(null)}
        onSaved={(p) => creatingFor && add(p, creatingFor)}
      />
    </>
  );
}
