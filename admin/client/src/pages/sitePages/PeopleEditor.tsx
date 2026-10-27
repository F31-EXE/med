import { useRef } from "react";
import { Button, Flex, Input, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { SortableList } from "../../components/SortableList";
import type { Review } from "./pageTypes";

type Item = Partial<Review> & { name: string };

type Props<T> = {
  value?: T[];
  onChange?: (value: T[]) => void;
  withQuote?: boolean;
  max: number;
  addLabel: string;
  disabled?: boolean;
};

export function PeopleEditor<T extends { name: string }>({ value = [], onChange, withQuote, max, addLabel, disabled }: Props<T>) {
  const ids = useRef(new WeakMap<object, string>());
  const counter = useRef(0);
  const idOf = (item: object) => {
    if (!ids.current.has(item)) ids.current.set(item, `p${counter.current++}`);
    return ids.current.get(item)!;
  };

  const items = value as unknown as Item[];
  const emit = (next: Item[]) => onChange?.(next as unknown as T[]);
  const patch = (item: Item, change: Partial<Item>) => {
    const updated = { ...item, ...change };
    ids.current.set(updated, idOf(item));
    emit(items.map((x) => (x === item ? updated : x)));
  };

  return (
    <>
      {items.length > 0 && (
        <SortableList
          items={items}
          getId={(i) => idOf(i)}
          disabled={disabled}
          onReorder={emit}
          renderItem={(item, handle) => (
            <Flex gap={12} align="flex-start" wrap style={{ padding: "12px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
              <div style={{ paddingTop: 36 }}>{handle}</div>
              <ImageUpload
                preset="speaker"
                disabled={disabled}
                value={item.photoUrl && item.photoThumbUrl ? { url: item.photoUrl, thumbUrl: item.photoThumbUrl } : null}
                onChange={(img) => patch(item, { photoUrl: img?.url ?? null, photoThumbUrl: img?.thumbUrl ?? null })}
              />
              <Flex vertical gap={8} style={{ flex: "1 1 240px", minWidth: 0 }}>
                {withQuote && (
                  <Input.TextArea
                    placeholder="Текст отзыва"
                    value={item.quote ?? ""}
                    maxLength={2000}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    disabled={disabled}
                    status={!item.quote?.trim() ? "warning" : undefined}
                    onChange={(e) => patch(item, { quote: e.target.value })}
                  />
                )}
                <Input
                  placeholder={withQuote ? "Автор" : "Имя и фамилия"}
                  value={item.name}
                  maxLength={120}
                  disabled={disabled}
                  status={!item.name.trim() ? "warning" : undefined}
                  onChange={(e) => patch(item, { name: e.target.value })}
                />
                <Input
                  placeholder="Должность"
                  value={item.position ?? ""}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(e) => patch(item, { position: e.target.value || null })}
                />
              </Flex>
              <Button type="text" danger icon={<DeleteOutlined />} disabled={disabled} onClick={() => emit(items.filter((x) => x !== item))} aria-label="Удалить" />
            </Flex>
          )}
        />
      )}
      <Flex align="center" gap={12} style={{ marginTop: items.length ? 12 : 0 }}>
        <Button
          icon={<PlusOutlined />}
          disabled={disabled || items.length >= max}
          onClick={() => emit([...items, { name: "", position: null, photoUrl: null, photoThumbUrl: null, ...(withQuote ? { quote: "" } : {}) } as Item])}
        >
          {addLabel}
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {items.length ? `${items.length} из ${max}. Порядок — перетаскиванием.` : null}
        </Typography.Text>
      </Flex>
    </>
  );
}
