import type { FormInstance } from "antd";
import { ApiError } from "./client";

export function applyFieldErrors(form: FormInstance, e: unknown) {
  if (!(e instanceof ApiError) || !e.fields) return false;
  form.setFields(
    Object.entries(e.fields).map(([key, error]) => ({
      name: key.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
      errors: [error],
    })),
  );
  return true;
}
