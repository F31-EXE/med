import { prisma } from "../../lib/prisma.js";
import { svedenSections } from "../../lib/documents.js";
import type { SiteCtx } from "../context.js";
import { titleOf, type View } from "../render.js";
import { Crumbs, crumbsLd, DocItem, Paras } from "../ui.js";

export async function svedenView(ctx: SiteCtx, key: string | null): Promise<View | null> {
  const root = ctx.page("sveden");
  const section = key ? svedenSections.find((s) => s.key === key) : null;
  if (key && !section) return null;
  const page = section ? ctx.page(`sveden-${section.key}`) : root;
  const docs = section
    ? await prisma.document.findMany({
        where: { svedenSection: section.key },
        orderBy: { sectionSortOrder: "asc" },
        select: { title: true, description: true, publicId: true, extension: true, size: true, fileUpdatedAt: true },
      })
    : [];
  const counts = section
    ? []
    : await prisma.document.groupBy({ by: ["svedenSection"], where: { svedenSection: { not: null } }, _count: true });
  const countMap = new Map(counts.map((c) => [c.svedenSection, c._count]));
  const crumbs = section ? [{ href: "/sveden", label: root.title }, { label: page.title }] : [{ label: root.title }];
  const path = section ? `/sveden/${section.key}` : "/sveden";

  return {
    meta: {
      title: page.seoTitle ?? titleOf(ctx, section ? `${page.title} — ${root.title}` : root.title),
      description: page.seoDescription ?? `${page.title}. Сведения об образовательной организации ООО «МедиаЭкспоГрупп».`,
      canonical: path,
      jsonLd: [crumbsLd(ctx, crumbs.map((c) => ({ ...c, href: c.href ?? path })))],
    },
    body: (
      <div className="wrap">
        <Crumbs items={crumbs} />
        <div className="page-head">
          <span className="eyebrow">Сведения об образовательной организации</span>
          <h1>{page.title}</h1>
        </div>
        <div className="sv-layout">
          <nav className="sv-nav" aria-label="Подразделы сведений">
            <a href="/sveden" aria-current={!section ? "page" : undefined}>
              Все подразделы
            </a>
            {svedenSections.map((s) => (
              <a key={s.key} href={`/sveden/${s.key}`} aria-current={section?.key === s.key ? "page" : undefined}>
                {ctx.page(`sveden-${s.key}`).title}
              </a>
            ))}
          </nav>
          <div>
            {section ? (
              <>
                {page.body ? <Paras text={page.body} className="prose" /> : !docs.length ? <div className="sv-empty">Сведения в этом подразделе отсутствуют.</div> : null}
                {docs.length ? (
                  <div className="docs" style={{ marginTop: page.body ? 24 : 0 }}>
                    {docs.map((d) => (
                      <DocItem key={d.publicId} d={{ ...d, url: `/files/${d.publicId}` }} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <Paras text={root.body} className="prose" />
                <div className="docs" style={{ marginTop: 20 }}>
                  {svedenSections.map((s) => (
                    <a className="doc" key={s.key} href={`/sveden/${s.key}`}>
                      <span className="ic w" aria-hidden="true">
                        {String(svedenSections.indexOf(s) + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <b>{ctx.page(`sveden-${s.key}`).title}</b>
                        <span>{countMap.get(s.key) ? `Документов: ${countMap.get(s.key)}` : "Подраздел"}</span>
                      </div>
                      <span className="dl" aria-hidden="true">
                        →
                      </span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    ),
  };
}
