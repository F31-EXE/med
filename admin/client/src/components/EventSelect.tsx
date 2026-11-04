import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Select, Typography } from "antd";
import { api } from "../api/client";

type Option = { id: string; title: string; startDate: string };

type Props = {
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function EventSelect({ value, onChange, placeholder = "Не привязана", disabled }: Props) {
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["event-options", q, value],
    queryFn: () =>
      api<{ items: Option[] }>(`/events/options?q=${encodeURIComponent(q)}${value ? `&ids=${value}` : ""}`).then((r) => r.items),
    staleTime: 30 * 1000,
  });

  return (
    <Select
      value={value ?? undefined}
      onChange={(v) => onChange?.(v ?? null)}
      allowClear
      disabled={disabled}
      placeholder={placeholder}
      style={{ width: "100%" }}
      popupMatchSelectWidth
      showSearch={{ filterOption: false, onSearch: setQ }}
      loading={search.isFetching}
      notFoundContent={search.isFetching ? "Поиск…" : "Мероприятий не найдено"}
      options={search.data?.map((e) => ({ value: e.id, label: e.title, date: dayjs(e.startDate).format("DD.MM.YYYY") }))}
      optionRender={(o) => (
        <span style={{ whiteSpace: "normal", lineHeight: 1.4 }}>
          {o.label}{" "}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            · {o.data.date}
          </Typography.Text>
        </span>
      )}
    />
  );
}
