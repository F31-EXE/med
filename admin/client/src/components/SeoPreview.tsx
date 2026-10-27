import { Typography } from "antd";

const SITE = "med-expo.org";

function lengthHint(len: number, good: [number, number]) {
  if (len === 0) return { type: "secondary" as const, text: "не заполнено — подставится автоматически" };
  if (len < good[0]) return { type: "warning" as const, text: `${len} симв., коротковато (лучше ${good[0]}–${good[1]})` };
  if (len > good[1]) return { type: "warning" as const, text: `${len} симв., поисковик обрежет (лучше до ${good[1]})` };
  return { type: "success" as const, text: `${len} симв., хорошо` };
}

type Props = { title: string; fallbackTitle: string; description: string; fallbackDescription?: string; path: string | null };

export function SeoPreview({ title, fallbackTitle, description, fallbackDescription, path }: Props) {
  const shownTitle = title || fallbackTitle;
  const shownDesc = description || fallbackDescription || "Описание не заполнено: поисковик возьмёт фрагмент текста страницы.";
  const t = lengthHint(title.length, [30, 60]);
  const d = lengthHint(description.length, [70, 160]);
  return (
    <div>
      <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 12, background: "#fff", maxWidth: 620 }}>
        <div style={{ fontSize: 12, color: "#4d5156" }}>
          {SITE}
          {path && path !== "/" ? path.replace(/\//g, " › ").replace(/^ › /, " › ") : ""}
        </div>
        <div style={{ color: "#1a0dab", fontSize: 18, lineHeight: 1.3, margin: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shownTitle}
        </div>
        <div style={{ color: "#4d5156", fontSize: 13, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {shownDesc}
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        <Typography.Text type={t.type}>Title: {t.text}</Typography.Text>
        <br />
        <Typography.Text type={d.type}>Description: {d.text}</Typography.Text>
      </div>
    </div>
  );
}
