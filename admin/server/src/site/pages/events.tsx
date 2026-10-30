import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { parseDateOnly } from "../../lib/dates.js";
import type { EventFormat, Prisma } from "../../generated/prisma/client.js";
import type { SiteCtx } from "../context.js";
import { formatLabels, monthsNom } from "../format.js";
import { titleOf, type View } from "../render.js";
import { archiveWhere, eventCardSelect, toCards, upcomingWhere } from "../queries.js";
import { Crumbs, crumbsLd, EventCard, Pager, Paras } from "../ui.js";

const PER_PAGE = 12;
const formats = Object.keys(formatLabels) as EventFormat[];

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function eventsView(ctx: SiteCtx, req: Request): Promise<View> {
  const q = req.query;
  const tab = str(q.tab) === "archive" ? "archive" : "upcoming";
  const format = formats.includes(str(q.format) as EventFormat) ? (str(q.format) as EventFormat) : "";
  const direction = str(q.direction);
  const city = str(q.city);
  const year = /^\d{4}$/.test(str(q.year)) ? Number(str(q.year)) : 0;
  const month = /^(1[0-2]|[1-9])$/.test(str(q.month)) && year ? Number(str(q.month)) : 0;
  const page = Math.max(1, Number.parseInt(str(q.page), 10) || 1);

  const base = tab === "archive" ? archiveWhere() : upcomingWhere();
  const and: Prisma.EventWhereInput[] = [base];
  if (format) and.push({ format });
  if (direction) and.push({ directions: { some: { id: direction } } });
  if (city) and.push({ cityId: city });
  if (year) {
    const from = month ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
    const toDate = month ? new Date(Date.UTC(year, month, 0)) : new Date(Date.UTC(year, 11, 31));
    and.push({ startDate: { lte: toDate }, endDate: { gte: parseDateOnly(from) } });
    if (month) and.push({ dateUnknown: false });
  }
  const where: Prisma.EventWhereInput = { AND: and };

  const [total, rows, upcomingCount, archiveCount, directions, cities, years] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: { startDate: tab === "archive" ? "desc" : "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: eventCardSelect,
    }),
    prisma.event.count({ where: upcomingWhere() }),
    prisma.event.count({ where: archiveWhere() }),
    prisma.direction.findMany({ where: { isActive: true, events: { some: base } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.city.findMany({ where: { isActive: true, events: { some: base } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.event.findMany({ where: base, select: { startDate: true }, distinct: ["startDate"] }),
  ]);
  const events = await toCards(rows);
  const yearList = [...new Set(years.map((y) => y.startDate.getUTCFullYear()))].sort((a, b) => (tab === "archive" ? b - a : a - b));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const p = ctx.page("events");
  const filtered = !!(format || direction || city || year);

  const params = (over: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    const all = { tab: tab === "archive" ? "archive" : "", format, direction, city, year: year || "", month: month || "", ...over };
    for (const [k, v] of Object.entries(all)) if (v !== "" && v !== 0 && v !== undefined) sp.set(k, String(v));
    const s = sp.toString();
    return s ? `/events?${s}` : "/events";
  };

  const title = tab === "archive" ? "Архив мероприятий" : p.title;
  const crumbs = tab === "archive" ? [{ href: "/events", label: p.title }, { label: "Архив" }] : [{ label: p.title }];

  return {
    meta: {
      title: tab === "archive" ? titleOf(ctx, "Архив мероприятий") : (p.seoTitle ?? titleOf(ctx, "Медицинские мероприятия: конгрессы, конференции, семинары")),
      description: p.seoDescription ?? "Предстоящие медицинские конгрессы, конференции, семинары и выставки с регистрацией на сайте и баллами НМО.",
      canonical: tab === "archive" ? "/events?tab=archive" : "/events",
      noindex: filtered || page > 1,
      jsonLd: [crumbsLd(ctx, crumbs.map((c) => ({ ...c, href: c.href ?? (tab === "archive" ? "/events?tab=archive" : "/events") })))],
    },
    body: (
      <>
        <div className="wrap">
          <Crumbs items={crumbs} />
          <div className="page-head">
            <span className="eyebrow">Мероприятия</span>
            <h1>{title}</h1>
            <Paras text={p.body ?? "Медицинские конгрессы, научные конференции, обучающие семинары, выставки медтехники и онлайн-симпозиумы."} className="lead" />
          </div>
          <nav className="tabs" aria-label="Раздел каталога">
            <a href={tab === "archive" ? "/events" : params({ page: "" })} aria-current={tab === "upcoming" ? "page" : undefined}>
              Предстоящие<span className="cnt">{upcomingCount}</span>
            </a>
            <a href="/events?tab=archive" aria-current={tab === "archive" ? "page" : undefined}>
              Архив<span className="cnt">{archiveCount}</span>
            </a>
          </nav>
          <form className="filters js-autosubmit" method="get" action="/events" role="search" aria-label="Фильтры">
            {tab === "archive" ? <input type="hidden" name="tab" value="archive" /> : null}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="flt-format">Формат</label>
              <select className="select" id="flt-format" name="format" defaultValue={format}>
                <option value="">Все форматы</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {formatLabels[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="flt-direction">Направление</label>
              <select className="select" id="flt-direction" name="direction" defaultValue={direction}>
                <option value="">Все направления</option>
                {directions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="flt-city">Город</label>
              <select className="select" id="flt-city" name="city" defaultValue={city}>
                <option value="">Все города</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="label" id="flt-period">
                Период
              </span>
              <div className="row2" style={{ gap: 8 }} role="group" aria-labelledby="flt-period">
                <select className="select" name="year" defaultValue={year ? String(year) : ""} aria-label="Год">
                  <option value="">Любой год</option>
                  {yearList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select className="select" name="month" defaultValue={month ? String(month) : ""} aria-label="Месяц">
                  <option value="">Любой месяц</option>
                  {monthsNom.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="actions" style={{ alignSelf: "end" }}>
              <button className="btn btn-sm" type="submit">
                Показать
              </button>
              {filtered ? (
                <a className="reset" href={tab === "archive" ? "/events?tab=archive" : "/events"}>
                  Сбросить
                </a>
              ) : null}
            </div>
          </form>
          {events.length ? (
            <>
              <p className="muted" aria-live="polite">
                Найдено: {total}
              </p>
              <div className="grid g3">
                {events.map((e) => (
                  <EventCard key={e.slug} e={e} ctx={ctx} />
                ))}
              </div>
              <Pager page={page} pages={pages} href={(n) => params({ page: n > 1 ? n : "" })} />
            </>
          ) : (
            <div className="empty">
              <h3>{filtered ? "По этим условиям ничего не нашлось" : tab === "archive" ? "В архиве пока пусто" : "Скоро здесь появятся новые мероприятия"}</h3>
              <p>{filtered ? "Попробуйте изменить или сбросить фильтры." : "Подпишитесь на новости, чтобы не пропустить анонсы."}</p>
              {filtered ? (
                <a className="btn btn-ghost" href={tab === "archive" ? "/events?tab=archive" : "/events"}>
                  Сбросить фильтры
                </a>
              ) : tab === "upcoming" ? (
                <a className="btn btn-ghost" href="/events?tab=archive">
                  Смотреть архив
                </a>
              ) : null}
            </div>
          )}
        </div>
      </>
    ),
  };
}
