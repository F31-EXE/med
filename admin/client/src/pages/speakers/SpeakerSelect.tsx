import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Flex, Select, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { speakerCaption, type SpeakerBrief } from "./speakerTypes";

type Props = {
  value?: string;
  onChange?: (id: string, speaker: SpeakerBrief) => void;
  known?: SpeakerBrief[];
  exclude?: string[];
  placeholder?: string;
  style?: CSSProperties;
};

export function SpeakerOption({ s }: { s: SpeakerBrief }) {
  return (
    <Flex gap={8} align="center" style={{ minWidth: 0 }}>
      <Avatar size="small" src={s.photoThumbUrl ?? undefined} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {s.fullName}
        {speakerCaption(s) && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {" "}
            · {speakerCaption(s)}
          </Typography.Text>
        )}
      </span>
    </Flex>
  );
}

export function SpeakerSelect({ value, onChange, known = [], exclude = [], placeholder = "Начните вводить фамилию", style }: Props) {
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["speakers", "search", q],
    queryFn: () => api<{ items: SpeakerBrief[] }>(`/speakers?pageSize=20&q=${encodeURIComponent(q)}`).then((r) => r.items),
    staleTime: 30 * 1000,
  });

  const byId = new Map<string, SpeakerBrief>();
  for (const s of [...known, ...(search.data ?? [])]) byId.set(s.id, s);
  const options = [...byId.values()]
    .filter((s) => s.id === value || !exclude.includes(s.id))
    .filter((s) => s.id === value || (search.data ?? []).some((r) => r.id === s.id))
    .map((s) => ({ value: s.id, label: <SpeakerOption s={s} />, title: s.fullName }));

  return (
    <Select
      value={value}
      placeholder={placeholder}
      showSearch={{ filterOption: false, onSearch: setQ }}
      onChange={(id: string) => onChange?.(id, byId.get(id)!)}
      options={options}
      loading={search.isFetching}
      notFoundContent={search.isFetching ? "Поиск…" : "Не найдено. Добавьте спикера в справочник"}
      style={style}
      popupMatchSelectWidth={false}
    />
  );
}
