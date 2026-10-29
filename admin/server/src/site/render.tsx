import type { ReactNode } from "react";
import type { Response } from "express";
import { renderToStaticMarkup } from "react-dom/server";
import type { SiteCtx } from "./context.js";
import { Document, type Meta } from "./layout.js";

export type View = { meta: Meta; body: ReactNode; status?: number };

export function send(res: Response, ctx: SiteCtx, view: View) {
  const html = "<!doctype html>" + renderToStaticMarkup(<Document ctx={ctx} meta={view.meta}>{view.body}</Document>);
  res.status(view.status ?? 200).type("html").set("Cache-Control", "no-cache").send(html);
}

export function titleOf(ctx: SiteCtx, title: string) {
  return title.includes("Media Expo Group") ? title : `${title} — Media Expo Group`;
}
