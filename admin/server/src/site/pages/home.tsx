import { prisma } from "../../lib/prisma.js";
import type { EventFormat } from "../../generated/prisma/client.js";
import type { SiteCtx } from "../context.js";
import { dateRange, formatPlural } from "../format.js";
import { DoctorsIllustration, FormatIllustration, formatTint, Icon } from "../icons.js";
import { titleOf, type View } from "../render.js";
import { eventCardSelect, newsCardSelect, publishedNewsWhere, toCards, upcomingWhere } from "../queries.js";
import { ContactForm, EventCard, NewsCard, PartnerTile, Reviews, SectionHead, Stats } from "../ui.js";
import { phoneHref } from "../format.js";

const formatHints: Record<EventFormat, string> = {
  CONGRESS: "Всероссийские и международные встречи профессионального сообщества",
  CONFERENCE: "Научно-практические конференции с тезисами и публикациями",
  SEMINAR: "Школы и мастер-классы в небольших группах",
  EXHIBITION: "Экспозиции производителей медицинской техники",
  ONLINE_SYMPOSIUM: "Трансляции с контролем присутствия для НМО",
};

const formats: EventFormat[] = ["CONGRESS", "CONFERENCE", "SEMINAR", "EXHIBITION", "ONLINE_SYMPOSIUM"];

export const steps = [
  { icon: Icon.chat, title: "Заявка", text: "Обсуждаем задачу, формат, аудиторию и бюджет" },
  { icon: Icon.clipboard, title: "Программа", text: "Научный комитет, спикеры и аккредитация НМО" },
  { icon: Icon.bus, title: "Логистика", text: "Площадка, техника, проживание и регистрация" },
  { icon: Icon.star, title: "Проведение", text: "Встречаем гостей и готовим итоговый отчёт" },
];

export async function homeView(ctx: SiteCtx): Promise<View> {
  const home = ctx.page("home");
  const about = ctx.page("about");
  const [eventRows, news, partners] = await Promise.all([
    prisma.event.findMany({ where: upcomingWhere(), orderBy: { startDate: "asc" }, take: 6, select: eventCardSelect }),
    prisma.news.findMany({ where: publishedNewsWhere(), orderBy: [{ publishAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 3, select: newsCardSelect }),
    prisma.partner.findMany({ where: { showOnHome: true }, orderBy: [{ homeSortOrder: "asc" }, { name: "asc" }], take: 12, select: { name: true, url: true, logoThumbUrl: true } }),
  ]);
  const events = await toCards(eventRows);
  const next = events[0];
  const b = home.blocks as { heroTitle: string | null; heroSubtitle: string | null; heroButtonText: string | null };
  const reviews = ((about.blocks?.reviews ?? []) as any[]).slice(0, 3);
  const c = ctx.settings.contacts;
  const heroTitle = b.heroTitle ?? "Организация медицинских конгрессов и конференций";

  return {
    meta: {
      title: home.seoTitle ?? titleOf(ctx, heroTitle),
      description: home.seoDescription ?? b.heroSubtitle ?? "Организация медицинских конгрессов, научных конференций, семинаров и выставок медтехники.",
      canonical: "/",
    },
    body: (
      <>
        <section className="hero">
          <div className="wrap">
            <div className="hero-box">
              <span className="blob blob-a" />
              <span className="blob blob-b" />
              <div className="hero-text">
                <span className="eyebrow">♡ Медицинские мероприятия для врачей</span>
                <h1>{heroTitle}</h1>
                <p>{b.heroSubtitle ?? "Берём на себя всю организацию, чтобы врачи могли сосредоточиться на главном — знаниях, общении и заботе о пациентах."}</p>
                <div className="hero-actions">
                  <a className="btn" href="/events">
                    {b.heroButtonText ?? "Ближайшие мероприятия"}
                  </a>
                  <a className="btn btn-ghost" href={`${ctx.href("contacts")}#form`}>
                    Обсудить мероприятие
                  </a>
                </div>
                <div className="hero-trust">
                  <span>
                    <b>✓</b>Баллы НМО
                  </span>
                  <span>
                    <b>✓</b>Онлайн-регистрация
                  </span>
                  <span>
                    <b>✓</b>Очно и онлайн
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <div className="hero-photo">
                  <DoctorsIllustration />
                </div>
                <div className="bubble bubble-1">
                  <i>✚</i>
                  <span>
                    Баллы НМО
                    <small>для участников</small>
                  </span>
                </div>
                {next ? (
                  <a className="bubble bubble-2" href={`/events/${next.slug}`} style={{ color: "var(--ink)" }}>
                    <i>→</i>
                    <span>
                      Ближайшее: {next.title.length > 40 ? `${next.title.slice(0, 40)}…` : next.title}
                      <small>{dateRange(next.startDate, next.endDate)}</small>
                    </span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {ctx.settings.numbers.length ? (
          <section aria-label="Компания в цифрах">
            <div className="wrap">
              <Stats items={ctx.settings.numbers} />
            </div>
          </section>
        ) : null}

        <section className="section">
          <div className="wrap">
            <SectionHead
              eyebrow="Афиша"
              title={
                <>
                  Ближайшие <span className="accent">мероприятия</span>
                </>
              }
              lead="Регистрация открыта на сайте — займёт пару минут, подтверждение придёт на e-mail."
              action={
                <a className="btn btn-ghost" href="/events">
                  Все мероприятия →
                </a>
              }
            />
            {events.length ? (
              <div className="grid g3">
                {events.map((e) => (
                  <EventCard key={e.slug} e={e} ctx={ctx} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <h3>Афиша скоро обновится</h3>
                <p>Новые мероприятия появятся здесь. Посмотрите прошедшие в архиве.</p>
                <a className="btn btn-ghost" href="/events?tab=archive">
                  Архив мероприятий
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="section section-soft section-round">
          <div className="wrap">
            <SectionHead center eyebrow="Форматы" title={<>Мероприятия для <span className="accent">каждого</span></>} lead="Подберём формат, в котором участникам будет удобно учиться и общаться." />
            <div className="formats">
              {formats.map((f) => (
                <a className="format" key={f} href={`/events?format=${f}`}>
                  <span className="ill" style={{ background: formatTint[f] }}>
                    <FormatIllustration format={f} />
                  </span>
                  <h3>{formatPlural[f]}</h3>
                  <p>{formatHints[f]}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <SectionHead center eyebrow="Как мы работаем" title={<>Четыре шага до <span className="accent">события</span></>} lead="Один менеджер ведёт проект от заявки до итогового отчёта." />
            <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {steps.map((s, i) => (
                <li className="step" key={s.title}>
                  <span className="circ" aria-hidden="true">
                    <s.icon />
                    <b>{i + 1}</b>
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {news.length ? (
          <section className="section section-soft">
            <div className="wrap">
              <SectionHead
                eyebrow="Новости"
                title="Новости и анонсы"
                action={
                  <a className="btn btn-ghost" href="/news">
                    Все новости →
                  </a>
                }
              />
              <div className="grid g3">
                {news.map((n) => (
                  <NewsCard key={n.slug} n={n} ctx={ctx} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {reviews.length ? (
          <section className="section">
            <div className="wrap">
              <SectionHead center eyebrow="Отзывы" title={<>Нам <span className="accent">доверяют</span></>} />
              <Reviews items={reviews} />
            </div>
          </section>
        ) : null}

        {partners.length ? (
          <section className="section" style={{ paddingTop: reviews.length ? 40 : undefined }}>
            <div className="wrap">
              <SectionHead center eyebrow="Партнёры" title="Партнёры и клиенты" />
              <div className="partners">
                {partners.map((p) => (
                  <PartnerTile key={p.name} p={p} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="section" style={{ paddingTop: 24 }}>
          <div className="wrap">
            <div className="cta">
              <span className="blob blob-a" />
              <span className="blob blob-b" />
              <div style={{ position: "relative" }}>
                <h2>Планируете медицинское мероприятие?</h2>
                <p>Расскажите о задаче — подготовим концепцию и смету, ответим в течение рабочего дня.</p>
                <div className="cta-contacts">
                  {c.headerPhone ? (
                    <a href={phoneHref(c.headerPhone)}>
                      <span>Позвонить</span>
                      <b>{c.headerPhone}</b>
                    </a>
                  ) : null}
                  {c.emails[0] ? (
                    <a href={`mailto:${c.emails[0].email}`}>
                      <span>Написать</span>
                      <b>{c.emails[0].email}</b>
                    </a>
                  ) : null}
                  {c.address ? (
                    <div>
                      <span>Офис</span>
                      <b>{c.address}</b>
                    </div>
                  ) : null}
                  {c.workHours ? (
                    <div>
                      <span>Режим работы</span>
                      <b>{c.workHours}</b>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="cta-form">
                <ContactForm ctx={ctx} source="Главная" title="Заявка на мероприятие" compact />
              </div>
            </div>
          </div>
        </section>
      </>
    ),
  };
}
