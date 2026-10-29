import { prisma } from "../../lib/prisma.js";
import type { SiteCtx } from "../context.js";
import { titleOf, type View } from "../render.js";
import { steps } from "./home.js";
import { initials } from "../format.js";
import { Crumbs, crumbsLd, PartnerTile, Paras, Reviews, SectionHead, Stats } from "../ui.js";

type Person = { name: string; position: string | null; photoThumbUrl: string | null };

export async function aboutView(ctx: SiteCtx): Promise<View> {
  const p = ctx.page("about");
  const team = (p.blocks?.team ?? []) as Person[];
  const reviews = p.blocks?.reviews ?? [];
  const partners = await prisma.partner.findMany({
    where: { showOnHome: true },
    orderBy: [{ homeSortOrder: "asc" }, { name: "asc" }],
    take: 12,
    select: { name: true, url: true, logoThumbUrl: true },
  });
  const path = ctx.href("about");
  const images = ctx.a11y.images || !ctx.a11y.on;
  return {
    meta: {
      title: p.seoTitle ?? titleOf(ctx, p.title),
      description: p.seoDescription ?? "Media Expo Group — организатор медицинских конгрессов, научных конференций, семинаров и выставок.",
      canonical: path,
      jsonLd: [crumbsLd(ctx, [{ href: path, label: p.title }])],
    },
    body: (
      <>
        <div className="wrap">
          <Crumbs items={[{ label: p.title }]} />
          <div className="page-head">
            <span className="eyebrow">О компании</span>
            <h1>{p.title}</h1>
          </div>
          <Paras text={p.body ?? "Media Expo Group организует медицинские конгрессы, конференции, обучающие семинары и выставки медицинской техники."} className="prose" />
          {ctx.settings.numbers.length ? (
            <div style={{ marginTop: 36 }}>
              <Stats items={ctx.settings.numbers} />
            </div>
          ) : null}
        </div>

        <section className="section">
          <div className="wrap">
            <SectionHead center eyebrow="Как мы работаем" title={<>Четыре шага до <span className="accent">события</span></>} />
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

        {team.length ? (
          <section className="section section-soft section-round">
            <div className="wrap">
              <SectionHead eyebrow="Команда" title="Наша команда" />
              <div className="spk-grid">
                {team.map((m, i) => (
                  <div className="spk" key={i}>
                    <div className="ph" style={m.photoThumbUrl && images ? { backgroundImage: `url("${m.photoThumbUrl}")` } : undefined}>
                      {m.photoThumbUrl && images ? null : initials(m.name)}
                    </div>
                    <b>{m.name}</b>
                    {m.position ? <span>{m.position}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {reviews.length ? (
          <section className="section">
            <div className="wrap">
              <SectionHead center eyebrow="Отзывы" title={<>Нам <span className="accent">пишут</span></>} />
              <Reviews items={reviews} />
            </div>
          </section>
        ) : null}

        {partners.length ? (
          <section className="section" style={{ paddingTop: 30 }}>
            <div className="wrap">
              <SectionHead center eyebrow="Партнёры" title="Партнёры и клиенты" />
              <div className="partners">
                {partners.map((pt) => (
                  <PartnerTile key={pt.name} p={pt} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </>
    ),
  };
}
