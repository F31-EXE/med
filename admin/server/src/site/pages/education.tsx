import { prisma } from "../../lib/prisma.js";
import type { SiteCtx } from "../context.js";
import { titleOf, type View } from "../render.js";
import { ContactForm, Crumbs, crumbsLd, DocItem, Paras } from "../ui.js";

const fallback = `Дополнительная профессиональная программа повышения квалификации «Акушерство и гинекология» с применением дистанционных образовательных технологий с помощью сети Интернет.

Форма обучения: заочная с применением электронного обучения и дистанционных образовательных технологий.

По окончании обучения выдаётся документ о квалификации установленного образца. Образовательная деятельность ведётся на основании лицензии; сведения об образовательной организации, документы и программы размещены в разделе «Сведения об образовательной организации».`;

export async function educationView(ctx: SiteCtx): Promise<View> {
  const p = ctx.page("education");
  const path = ctx.href("education");
  const docs = await prisma.document.findMany({
    where: { svedenSection: "education" },
    orderBy: { sectionSortOrder: "asc" },
    select: { title: true, description: true, publicId: true, extension: true, size: true, fileUpdatedAt: true },
  });
  return {
    meta: {
      title: p.seoTitle ?? titleOf(ctx, p.title),
      description: p.seoDescription ?? "Повышение квалификации для врачей: программа «Акушерство и гинекология» с применением дистанционных образовательных технологий. Заявка на обучение.",
      canonical: path,
      jsonLd: [crumbsLd(ctx, [{ href: path, label: p.title }])],
    },
    body: (
      <div className="wrap">
        <Crumbs items={[{ label: p.title }]} />
        <div className="page-head">
          <span className="eyebrow">Обучение</span>
          <h1>{p.title}</h1>
        </div>
        <div className="contacts-grid" style={{ paddingBottom: 72 }}>
          <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
            <div className="cblock">
              <Paras text={p.body ?? fallback} className="prose" />
            </div>
            {docs.length ? (
              <div className="cblock">
                <h3 style={{ marginBottom: 14 }}>Программы и документы</h3>
                <div className="docs">
                  {docs.map((d) => (
                    <DocItem key={d.publicId} d={{ ...d, url: `/files/${d.publicId}` }} />
                  ))}
                </div>
              </div>
            ) : null}
            <div className="cblock">
              <h3 style={{ marginBottom: 10 }}>Сведения об образовательной организации</h3>
              <p className="muted" style={{ marginBottom: 14 }}>Лицензия, учебные планы, педагогический состав и платные образовательные услуги.</p>
              <div className="hero-actions">
                <a className="btn btn-ghost btn-sm" href="/sveden/education">
                  Образование
                </a>
                <a className="btn btn-ghost btn-sm" href="/sveden/document">
                  Документы и лицензия
                </a>
                <a className="btn btn-ghost btn-sm" href="/sveden/paid_edu">
                  Платные услуги
                </a>
              </div>
            </div>
          </div>
          <div className="cblock" id="form" style={{ alignSelf: "start", scrollMarginTop: 100 }}>
            <ContactForm ctx={ctx} source="Обучение" title="Заявка на обучение" placeholder="Какая программа интересует, сколько слушателей, удобные сроки" />
          </div>
        </div>
      </div>
    ),
  };
}
