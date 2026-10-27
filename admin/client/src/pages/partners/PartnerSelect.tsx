import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flex, Select } from "antd";
import { api } from "../../api/client";
import { PartnerLogo } from "./PartnerLogo";
import type { PartnerBrief } from "./partnerTypes";

type Props = {
  onChange: (partner: PartnerBrief) => void;
  exclude?: string[];
  placeholder?: string;
  style?: CSSProperties;
};

export function PartnerSelect({ onChange, exclude = [], placeholder = "Добавить партнёра: начните вводить название", style }: Props) {
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["partners", "search", q],
    queryFn: () => api<{ items: PartnerBrief[] }>(`/partners?pageSize=20&q=${encodeURIComponent(q)}`).then((r) => r.items),
    staleTime: 30 * 1000,
  });
  const items = (search.data ?? []).filter((p) => !exclude.includes(p.id));

  return (
    <Select
      value={null}
      placeholder={placeholder}
      showSearch={{ filterOption: false, onSearch: setQ }}
      onChange={(id: string) => {
        const p = items.find((x) => x.id === id);
        if (p) onChange(p);
      }}
      loading={search.isFetching}
      notFoundContent={search.isFetching ? "Поиск…" : "Не найдено. Добавьте партнёра в справочник"}
      options={items.map((p) => ({
        value: p.id,
        label: (
          <Flex gap={8} align="center">
            <PartnerLogo partner={p} width={48} height={24} />
            {p.name}
          </Flex>
        ),
      }))}
      style={style}
    />
  );
}
