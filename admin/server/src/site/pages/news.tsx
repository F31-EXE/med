import type { Request } from "express";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import type { SiteCtx } from "../context.js";
import { newsDate, stripHtml, truncate } from "../format.js";
import { titleOf, type View } from "../render.js";
import { eventCardSelect, newsCardSelect, publishedNewsWhere, toCards } from "../queries.js";
import { bg, Crumbs, crumbsLd, EventCard, NewsCard, Pager, Paras } from "../ui.js";

const PER_PAGE = 12;

export async function newsListView(ctx: SiteCtx, req: Request): Promise<View> {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? ""), 10) || 1);
  const where = publishedNewsWhere();
  const [total, items] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      orderBy: [{ publishAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: newsCardSelect,
    }),
  ]);
  const p = ctx.page("news");
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return {
    meta: {
      title: p.seoTitle ?? titleOf(ctx, "Новости и анонсы"),
      description: p.seoDescription ?? "Новости, анонсы и итоги медицинских мероприятий Media Expo Group.",
      canonical: page > 1 ? `/news?page=${page}` : "/news",
      jsonLd: [crumbsLd(ctx, [{ href: "/news", label: p.title }])],
    },
    body: (
      <div className="wrap">
        <Crumbs items={[{ label: p.title }]} />
        <div className="page-head">
          <span className="eyebrow">Новости</span>
          <h1>{p.title}</h1>
          <Paras text={p.body} className="lead" />
        </div>
        {items.length ? (
          <>
            <div className="grid g3">
              {items.map((n) => (
                <NewsCard key={n.slug} n={n} ctx={ctx} />
              ))}
            </div>
            <Pager page={page} pages={pages} href={(n) => (n > 1 ? `/news?page=${n}` : "/news")} />
          </>
        ) : (
          <div className="empty">
            <h3>Новостей пока нет</h3>
            <p>Скоро здесь появятся анонсы и итоги мероприятий.</p>
          </div>
        )}
      </div>
    ),
  };
}

export async function newsItemView(ctx: SiteCtx, slug: string): Promise<View | null> {
  const n = await prisma.news.findFirst({
    where: { ...publishedNewsWhere(), slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      event: { select: eventCardSelect },
    },
  });
  if (!n) return null;
  const [eventCard] = n.event && n.event.status === "PUBLISHED" && !n.event.deletedAt ? await toCards([n.event]) : [];
  const more = await prisma.news.findMany({
    where: { ...publishedNewsWhere(), NOT: { id: n.id } },
    orderBy: [{ publishAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 3,
    select: newsCardSelect,
  });
  const url = `${ctx.origin}/news/${n.slug}`;
  const images = ctx.a11y.images || !ctx.a11y.on;
  const description = n.seoDescription ?? n.excerpt ?? (n.body ? truncate(stripHtml(n.body), 200) : null);
  return {
    meta: {
      title: n.seoTitle ?? titleOf(ctx, n.title),
      description,
      image: n.coverUrl,
      type: "article",
      canonical: `/news/${n.slug}`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: n.title,
          description: description ?? undefined,
          datePublished: (n.publishAt ?? n.createdAt).toISOString(),
          dateModified: n.updatedAt.toISOString(),
          image: n.coverUrl ? [`${ctx.origin}${n.coverUrl}`] : undefined,
          mainEntityOfPage: url,
          publisher: { "@type": "Organization", name: "Media Expo Group", url: ctx.origin },
        },
        crumbsLd(ctx, [{ href: "/news", label: "Новости" }, { href: `/news/${n.slug}`, label: n.title }]),
      ],
    },
    body: (
      <>
        <div className="wrap">
          <Crumbs items={[{ href: "/news", label: "Новости" }, { label: n.title }]} />
          <article className="article">
            <div className="page-head" style={{ paddingBottom: 10 }}>
              <time className="chip chip-mint" dateTime={(n.publishAt ?? n.createdAt).toISOString()}>
                {newsDate(n.publishAt ?? n.createdAt, config.TIMEZONE)}
              </time>
              <h1>{n.title}</h1>
              {n.excerpt ? <p className="lead">{n.excerpt}</p> : null}
            </div>
            {n.coverUrl && images ? <div className="article-cover" style={bg(n.coverUrl)} role="img" aria-label={n.title} /> : null}
            {n.body ? <div className="prose" dangerouslySetInnerHTML={{ __html: n.body }} /> : null}
            {n.images.length && images ? (
              <div className="gallery" style={{ marginTop: 28 }}>
                {n.images.map((im, i) => (
                  <figure key={im.id}>
                    <a href={im.url} target="_blank" style={{ backgroundImage: `url("${im.thumbUrl}")` }} aria-label={im.caption ?? `Фото ${i + 1}`} />
                    {im.caption ? <figcaption>{im.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : null}
            {eventCard ? (
              <div style={{ marginTop: 36, maxWidth: 420 }}>
                <h3 style={{ marginBottom: 14 }}>Мероприятие</h3>
                <EventCard e={eventCard} ctx={ctx} />
              </div>
            ) : null}
            <div className="share">
              Поделиться:
              <a className="btn btn-sm btn-ghost" href={`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(n.title)}`} target="_blank" rel="noopener">
                ВКонтакте
              </a>
              <a className="btn btn-sm btn-ghost" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(n.title)}`} target="_blank" rel="noopener">
                Telegram
              </a>
            </div>
          </article>
        </div>
        {more.length ? (
          <section className="section" style={{ paddingBottom: 0 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <h2>Другие новости</h2>
                </div>
                <a className="btn btn-ghost" href="/news">
                  Все новости →
                </a>
              </div>
              <div className="grid g3">
                {more.map((m) => (
                  <NewsCard key={m.slug} n={m} ctx={ctx} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </>
    ),
  };
}
