import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import type { SiteCtx } from "../context.js";
import { dateRange, formatLabels, plural, stripHtml, truncate } from "../format.js";
import { formatDateOnly } from "../../lib/dates.js";
import { titleOf, type View } from "../render.js";
import { publishedEvent, publishedNewsWhere } from "../queries.js";
import { Crumbs } from "../ui.js";

type Hit = { kind: string; title: string; href: string; text: string };

export async function searchView(ctx: SiteCtx, req: Request): Promise<View> {
  const p = ctx.page("search");
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  let hits: Hit[] = [];
  if (q.length >= 2) {
    const like = { contains: q, mode: "insensitive" as const };
    const [events, news, pages] = await Promise.all([
      prisma.event.findMany({
        where: { ...publishedEvent, OR: [{ title: like }, { subtitle: like }, { description: like }, { venueName: like }] },
        orderBy: { startDate: "desc" },
        take: 20,
        select: { title: true, slug: true, format: true, startDate: true, endDate: true, subtitle: true, description: true, city: { select: { name: true } } },
      }),
      prisma.news.findMany({
        where: { AND: [publishedNewsWhere(), { OR: [{ title: like }, { excerpt: like }, { body: like }] }] },
        orderBy: [{ publishAt: { sort: "desc", nulls: "last" } }],
        take: 20,
        select: { title: true, slug: true, excerpt: true, body: true },
      }),
      prisma.page.findMany({ where: { OR: [{ title: like }, { body: like }] }, select: { key: true, title: true, body: true } }),
    ]);
    hits = [
      ...events.map((e) => ({
        kind: `${formatLabels[e.format]} · ${dateRange(formatDateOnly(e.startDate), formatDateOnly(e.endDate))}${e.city ? `, ${e.city.name}` : ""}`,
        title: e.title,
        href: `/events/${e.slug}`,
        text: truncate(e.subtitle ?? e.description ?? "", 180),
      })),
      ...news.map((n) => ({ kind: "Новость", title: n.title, href: `/news/${n.slug}`, text: truncate(n.excerpt ?? stripHtml(n.body ?? ""), 180) })),
      ...pages
        .filter((pg) => ctx.pages.get(pg.key)?.path && pg.key !== "search" && pg.key !== "thanks")
        .map((pg) => ({ kind: "Страница", title: pg.title, href: ctx.pages.get(pg.key)!.path!, text: truncate(pg.body ?? "", 180) })),
    ];
  }
  return {
    meta: { title: p.seoTitle ?? titleOf(ctx, q ? `Поиск: ${q}` : p.title), description: p.seoDescription, noindex: true },
    body: (
      <div className="wrap">
        <Crumbs items={[{ label: p.title }]} />
        <div className="page-head" style={{ paddingBottom: 10 }}>
          <h1>{p.title}</h1>
        </div>
        <form className="search-form" method="get" role="search">
          <label className="sr-only" htmlFor="q">
            Что ищем
          </label>
          <input className="input" id="q" name="q" type="search" defaultValue={q} placeholder="Мероприятие, тема, город…" minLength={2} maxLength={100} />
          <button className="btn" type="submit">
            Найти
          </button>
        </form>
        {q.length >= 2 ? (
          hits.length ? (
            <>
              <p className="muted">
                {hits.length} {plural(hits.length, "результат", "результата", "результатов")} по запросу «{q}»
              </p>
              <div className="sres">
                {hits.map((h) => (
                  <a key={h.href} href={h.href}>
                    <small>{h.kind}</small>
                    <b>{h.title}</b>
                    {h.text ? <span>{h.text}</span> : null}
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <h3>Ничего не нашлось</h3>
              <p>Попробуйте другую формулировку или посмотрите каталог мероприятий.</p>
              <a className="btn btn-ghost" href="/events">
                Все мероприятия
              </a>
            </div>
          )
        ) : q ? (
          <p className="muted">Введите хотя бы два символа.</p>
        ) : null}
      </div>
    ),
  };
}
