import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { EventDetail, EventStatus } from "./eventTypes";

export function useEventActions() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const refresh = (event?: EventDetail) => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    if (event) queryClient.setQueryData(["event", event.id], event);
  };
  const onError = (e: Error) => message.error(e.message);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      api<{ event: EventDetail }>(`/events/${id}/status`, { body: { status } }).then((r) => r.event),
    onSuccess: (event) => {
      message.success(event.status === "PUBLISHED" ? "Мероприятие опубликовано" : "Мероприятие снято с публикации");
      refresh(event);
    },
    onError,
  });

  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api<{ event: EventDetail }>(`/events/${id}/archive`, { body: { archived } }).then((r) => r.event),
    onSuccess: (event) => {
      message.success(event.archivedAt ? "Мероприятие перенесено в архив" : "Мероприятие возвращено из архива");
      refresh(event);
    },
    onError,
  });

  const copy = useMutation({
    mutationFn: (id: string) => api<{ event: EventDetail }>(`/events/${id}/copy`, { method: "POST" }).then((r) => r.event),
    onSuccess: (event) => {
      message.success("Копия создана как черновик. Проверьте даты и адрес страницы");
      refresh(event);
      navigate(`/events/${event.id}`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      message.success("Мероприятие перемещено в корзину. Его можно восстановить в течение 30 дней");
      refresh();
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: string) => api<{ event: EventDetail }>(`/events/${id}/restore`, { method: "POST" }).then((r) => r.event),
    onSuccess: (event) => {
      message.success("Мероприятие восстановлено");
      refresh(event);
    },
    onError,
  });

  return { setStatus, setArchived, copy, remove, restore };
}
