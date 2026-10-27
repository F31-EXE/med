import { useState } from "react";
import { App, Button, Flex, Image, Input, Progress, Typography, Upload } from "antd";
import { DeleteOutlined, PictureOutlined } from "@ant-design/icons";
import { uploadImage } from "../api/uploads";
import { SortableList } from "./SortableList";

export type GalleryImage = { id?: string; url: string; thumbUrl: string; caption: string | null };

type Props = {
  value?: GalleryImage[];
  onChange?: (value: GalleryImage[]) => void;
  max?: number;
  disabled?: boolean;
};

export function GalleryEditor({ value = [], onChange, max = 60, disabled }: Props) {
  const { message } = App.useApp();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadFiles(files: File[]) {
    const room = max - value.length;
    if (files.length > room) message.warning(`Можно добавить ещё ${room} фото, остальные пропущены`);
    const batch = files.slice(0, room);
    if (!batch.length) return;
    setProgress({ done: 0, total: batch.length });
    const added: GalleryImage[] = [];
    for (const [i, file] of batch.entries()) {
      try {
        const img = await uploadImage(file, "gallery");
        added.push({ ...img, caption: null });
      } catch (e) {
        message.error(`${file.name}: ${(e as Error).message}`);
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    setProgress(null);
    if (added.length) onChange?.([...value, ...added]);
  }

  return (
    <>
      {value.length > 0 && (
        <SortableList
          items={value}
          getId={(i) => i.url}
          disabled={disabled}
          onReorder={(next) => onChange?.(next)}
          renderItem={(img, handle) => (
            <Flex align="center" gap={12} style={{ padding: "6px 0", borderBottom: "1px solid #f5f5f5", background: "#fff" }}>
              {handle}
              <Image src={img.thumbUrl} preview={{ src: img.url }} width={96} height={72} style={{ objectFit: "cover", borderRadius: 6 }} alt={img.caption ?? "Фото"} />
              <Input
                placeholder="Подпись к фото (необязательно)"
                value={img.caption ?? ""}
                maxLength={300}
                disabled={disabled}
                onChange={(e) => onChange?.(value.map((x) => (x.url === img.url ? { ...x, caption: e.target.value || null } : x)))}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => onChange?.(value.filter((x) => x.url !== img.url))}
                aria-label="Убрать фото"
              />
            </Flex>
          )}
        />
      )}
      <Flex align="center" gap={12} wrap style={{ marginTop: value.length ? 12 : 0 }}>
        <Upload
          accept="image/jpeg,image/png,image/webp"
          multiple
          showUploadList={false}
          disabled={disabled || !!progress || value.length >= max}
          beforeUpload={(_file, list) => {
            if (_file === list[0]) uploadFiles(list as unknown as File[]);
            return false;
          }}
        >
          <Button icon={<PictureOutlined />} disabled={disabled || !!progress || value.length >= max}>
            Добавить фото
          </Button>
        </Upload>
        {progress ? (
          <Progress percent={Math.round((progress.done / progress.total) * 100)} size="small" style={{ width: 200, margin: 0 }} format={() => `${progress.done} из ${progress.total}`} />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {value.length ? `Фото: ${value.length} из ${max}. Порядок — перетаскиванием.` : "Можно выбрать сразу несколько файлов: JPG, PNG или WebP до 10 МБ каждый."}
          </Typography.Text>
        )}
      </Flex>
    </>
  );
}
