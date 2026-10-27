import { useState } from "react";
import { App, Button, Flex, Image, Upload } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadImage, type UploadedImage } from "../api/uploads";

type Props = {
  value?: UploadedImage | null;
  onChange?: (value: UploadedImage | null) => void;
  preset?: "speaker" | "cover";
  disabled?: boolean;
};

export function ImageUpload({ value, onChange, preset = "speaker", disabled }: Props) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  return (
    <Flex gap={16} align="center" wrap>
      {value ? (
        <Image
          src={value.thumbUrl}
          preview={{ src: value.url }}
          width={96}
          height={96}
          style={{ objectFit: "cover", borderRadius: 8 }}
          alt="Фото"
        />
      ) : (
        <div style={{ width: 96, height: 96, borderRadius: 8, background: "#F3F6FA", display: "grid", placeItems: "center", color: "#8c8c8c", fontSize: 12 }}>
          Нет фото
        </div>
      )}
      <Flex vertical gap={8}>
        <Upload
          accept="image/jpeg,image/png,image/webp"
          showUploadList={false}
          disabled={disabled || loading}
          customRequest={async ({ file }) => {
            setLoading(true);
            try {
              onChange?.(await uploadImage(file as File, preset));
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <Button icon={<UploadOutlined />} loading={loading} disabled={disabled}>
            {value ? "Заменить" : "Загрузить"}
          </Button>
        </Upload>
        {value && (
          <Button icon={<DeleteOutlined />} onClick={() => onChange?.(null)} disabled={disabled}>
            Убрать
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
