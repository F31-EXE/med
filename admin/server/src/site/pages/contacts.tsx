import { formatPhone } from "../../lib/registrations.js";
import type { SiteCtx } from "../context.js";
import { phoneHref } from "../format.js";
import { Icon } from "../icons.js";
import { titleOf, type View } from "../render.js";
import { ContactForm, Crumbs, crumbsLd, Paras } from "../ui.js";

export async function contactsView(ctx: SiteCtx): Promise<View> {
  const p = ctx.page("contacts");
  const c = ctx.settings.contacts;
  const path = ctx.href("contacts");
  const images = ctx.a11y.images || !ctx.a11y.on;
  const phones = [...(c.headerPhone ? [{ label: "Основной телефон", number: c.headerPhone }] : []), ...c.phones.filter((x) => x.number !== c.headerPhone)];
  const map =
    c.mapLat !== null && c.mapLng !== null
      ? `https://yandex.ru/map-widget/v1/?ll=${c.mapLng},${c.mapLat}&z=16&pt=${c.mapLng},${c.mapLat},pm2rdm`
      : c.address
        ? `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(c.address)}&z=15`
        : null;
  const mapLink = c.mapLat !== null && c.mapLng !== null ? `https://yandex.ru/maps/?pt=${c.mapLng},${c.mapLat}&z=16&l=map` : `https://yandex.ru/maps/?text=${encodeURIComponent(c.address ?? "")}`;
  return {
    meta: {
      title: p.seoTitle ?? titleOf(ctx, p.title),
      description: p.seoDescription ?? `Контакты Media Expo Group${c.address ? `: ${c.address}` : ""}. Телефон, e-mail, форма обратной связи.`,
      canonical: path,
      jsonLd: [crumbsLd(ctx, [{ href: path, label: p.title }])],
    },
    body: (
      <div className="wrap">
        <Crumbs items={[{ label: p.title }]} />
        <div className="page-head">
          <span className="eyebrow">Контакты</span>
          <h1>{p.title}</h1>
          <Paras text={p.body} className="lead" />
        </div>
        <div className="contacts-grid">
          <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
            <div className="cblock">
              <h3>Как с нами связаться</h3>
              {phones.map((ph) => (
                <div className="cline" key={ph.number}>
                  <span className="ico">
                    <Icon.phone />
                  </span>
                  <div>
                    <span>{ph.label ?? "Телефон"}</span>
                    <a href={phoneHref(ph.number)}>{formatPhone(ph.number)}</a>
                  </div>
                </div>
              ))}
              {c.emails.map((e) => (
                <div className="cline" key={e.email}>
                  <span className="ico">
                    <Icon.mail />
                  </span>
                  <div>
                    <span>{e.label ?? "E-mail"}</span>
                    <a href={`mailto:${e.email}`}>{e.email}</a>
                  </div>
                </div>
              ))}
              {c.address ? (
                <div className="cline">
                  <span className="ico">
                    <Icon.pin />
                  </span>
                  <div>
                    <span>Адрес</span>
                    <b>{c.address}</b>
                  </div>
                </div>
              ) : null}
              {c.workHours ? (
                <div className="cline">
                  <span className="ico">
                    <Icon.clock />
                  </span>
                  <div>
                    <span>Режим работы</span>
                    <b>{c.workHours}</b>
                  </div>
                </div>
              ) : null}
            </div>
            {c.address || map ? (
              <div className="map">
                <div className="map-fallback">
                  <a href={mapLink} target="_blank" rel="noopener">
                    Открыть на Яндекс.Картах ↗
                  </a>
                </div>
                {map && images ? <iframe src={map} title="Карта: офис Media Expo Group" loading="lazy" /> : null}
              </div>
            ) : null}
            {c.requisites ? (
              <div className="cblock">
                <h3>Реквизиты</h3>
                <p className="req">{c.requisites}</p>
              </div>
            ) : null}
          </div>
          <div className="cblock" id="form" style={{ alignSelf: "start", scrollMarginTop: 100 }}>
            <ContactForm ctx={ctx} source="Контакты" title="Напишите нам" />
          </div>
        </div>
      </div>
    ),
  };
}
