import { ApiError } from "./client";

export type UploadedImage = { url: string; thumbUrl: string };

export async function uploadImage(file: File, preset: "speaker" | "cover" = "speaker"): Promise<UploadedImage> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch(`/api/uploads/image?preset=${preset}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте подключение");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Ошибка ${res.status}`);
  return data as UploadedImage;
}
