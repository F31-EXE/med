import type { ReactNode } from "react";
import { config } from "../config.js";
import { formatPhone } from "../lib/registrations.js";
import type { SiteCtx } from "./context.js";
import { phoneHref } from "./format.js";
import { Icon } from "./icons.js";

export const ASSET_VERSION = Date.now().toString(36);

export type Meta = {
  title: string;
  description?: string | null;
  canonical?: string;
  image?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: object[];
  stickyReg?: string;
};

function json(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

function abs(ctx: SiteCtx, url: string) {
  return /^https?:\/\//.test(url) ? url : `${ctx.origin}${url}`;
}

export function Document({ ctx, meta, children }: { ctx: SiteCtx; meta: Meta; children: ReactNode }) {
  const a = ctx.a11y;
  const htmlClass = ["no-js", a.on && "a11y", a.on && `fs-${a.fs}`, a.on && `sch-${a.scheme}`, a.on && a.ls && `ls-${a.ls}`, a.on && !a.images && "no-img", meta.stickyReg && "has-sticky"]
    .filter(Boolean)
    .join(" ");
  const canonical = abs(ctx, meta.canonical ?? ctx.path);
  const title = meta.title;
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Media Expo Group",
    legalName: "ООО «МедиаЭкспоГрупп»",
    url: ctx.origin,
    logo: `${ctx.origin}/assets/img/logo.png`,
    telephone: ctx.settings.contacts.headerPhone ?? undefined,
    address: ctx.settings.contacts.address ?? undefined,
  };
  return (
    <html lang="ru" className={htmlClass}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {meta.description ? <meta name="description" content={meta.description} /> : null}
        <link rel="canonical" href={canonical} />
        {meta.noindex ? <meta name="robots" content="noindex, follow" /> : null}
        <meta property="og:type" content={meta.type ?? "website"} />
        <meta property="og:site_name" content="Media Expo Group" />
        <meta property="og:locale" content="ru_RU" />
        <meta property="og:title" content={title} />
        {meta.description ? <meta property="og:description" content={meta.description} /> : null}
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={abs(ctx, meta.image ?? "/assets/img/og.png")} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#0B5ED7" />
        <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
        <link rel="preload" href="/assets/fonts/inter-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/assets/fonts/nunito-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="stylesheet" href={`/assets/site.css?v=${ASSET_VERSION}`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={json(org)} />
        {(meta.jsonLd ?? []).map((d, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={json(d)} />
        ))}
        <script src={`/assets/site.js?v=${ASSET_VERSION}`} defer />
        {config.METRIKA_ID && ctx.cookiesAccepted ? <Metrika id={config.METRIKA_ID} nonce={ctx.nonce} /> : null}
      </head>
      <body data-metrika={config.METRIKA_ID || undefined}>
        <a className="skip" href="#main">
          Перейти к содержанию
        </a>
        {a.on ? <A11yPanel ctx={ctx} /> : null}
        <Header ctx={ctx} />
        <main id="main">{children}</main>
        <Footer ctx={ctx} />
        {meta.stickyReg ? (
          <div className="sticky-reg">
            <a className="btn btn-block" href={meta.stickyReg}>
              Зарегистрироваться
            </a>
          </div>
        ) : null}
        <div className="cookie" data-cookie hidden={ctx.cookiesAccepted}>
          <span>
            Мы используем cookie и Яндекс.Метрику, чтобы сайт работал удобнее. <a href={ctx.href("privacy")}>Подробнее</a>
          </span>
          <a className="btn btn-sm btn-white" href={`/a11y/cookies?back=${encodeURIComponent(ctx.path)}`} data-cookie-ok>
            Понятно
          </a>
        </div>
      </body>
    </html>
  );
}

function Metrika({ id, nonce }: { id: string; nonce: string }) {
  const code = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${Number(id)},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
}

function nav(ctx: SiteCtx) {
  return [
    { href: "/events", label: "Мероприятия" },
    { href: "/news", label: "Новости" },
    { href: ctx.href("about"), label: "О компании" },
    { href: ctx.href("contacts"), label: "Контакты" },
  ];
}

function isActive(ctx: SiteCtx, href: string) {
  return href !== "/" && (ctx.path === href || ctx.path.startsWith(`${href}/`));
}

export function Logo() {
  return (
    <a className="logo" href="/" aria-label="Media Expo Group — на главную">
      <span className="logo-mark" aria-hidden="true" />
      <span>
        Media Expo Group
        <small>Медицинские мероприятия</small>
      </span>
    </a>
  );
}

function Header({ ctx }: { ctx: SiteCtx }) {
  const phone = ctx.settings.contacts.headerPhone;
  const items = nav(ctx);
  const back = encodeURIComponent(ctx.path);
  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <a href="/sveden" aria-current={ctx.path.startsWith("/sveden") ? "page" : undefined}>
            Сведения об образовательной организации
          </a>
          <span className="tb-info">{ctx.settings.contacts.workHours}</span>
          <a className="a11y-link" href={ctx.a11y.on ? `/a11y/off?back=${back}` : `/a11y/on?back=${back}`}>
            <Icon.eye />
            {ctx.a11y.on ? "Обычная версия" : "Версия для слабовидящих"}
          </a>
        </div>
      </div>
      <header className="header">
        <div className="wrap">
          <Logo />
          <nav className="nav" aria-label="Главное меню">
            {items.map((i) => (
              <a key={i.href} href={i.href} aria-current={isActive(ctx, i.href) ? "page" : undefined}>
                {i.label}
              </a>
            ))}
          </nav>
          <div className="h-actions">
            {phone ? (
              <a className="h-phone" href={phoneHref(phone)}>
                {phone}
              </a>
            ) : null}
            <a className="btn btn-sm h-cta" href={`${ctx.href("contacts")}#form`}>
              Оставить заявку
            </a>
            <details className="burger">
              <summary aria-label="Меню">
                <span />
              </summary>
              <nav className="m-menu" aria-label="Мобильное меню">
                {items.map((i) => (
                  <a key={i.href} href={i.href} aria-current={isActive(ctx, i.href) ? "page" : undefined}>
                    {i.label}
                  </a>
                ))}
                <a href="/sveden" aria-current={ctx.path.startsWith("/sveden") ? "page" : undefined}>
                  Сведения об образовательной организации
                </a>
                <a href={ctx.href("search")}>Поиск по сайту</a>
                {phone ? (
                  <a className="m-phone" href={phoneHref(phone)}>
                    {phone}
                  </a>
                ) : null}
                <a className="btn" href={`${ctx.href("contacts")}#form`}>
                  Оставить заявку
                </a>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

function A11yPanel({ ctx }: { ctx: SiteCtx }) {
  const a = ctx.a11y;
  const back = encodeURIComponent(ctx.path);
  const link = (q: string) => `/a11y/set?${q}&back=${back}`;
  return (
    <div className="a11y-panel" role="region" aria-label="Настройки версии для слабовидящих">
      <div className="wrap">
        <div className="grp">
          <span>Шрифт:</span>
          {([1, 2, 3] as const).map((n) => (
            <a key={n} href={link(`fs=${n}`)} aria-current={a.fs === n ? "true" : undefined} aria-label={`Размер шрифта ${n}`} style={{ fontSize: `${0.9 + n * 0.15}rem` }}>
              А
            </a>
          ))}
        </div>
        <div className="grp">
          <span>Цвет:</span>
          <a href={link("sch=bw")} aria-current={a.scheme === "bw" ? "true" : undefined}>
            Ч/Б
          </a>
          <a className="sch-wb" href={link("sch=wb")} aria-current={a.scheme === "wb" ? "true" : undefined}>
            Б/Ч
          </a>
          <a className="sch-blue" href={link("sch=blue")} aria-current={a.scheme === "blue" ? "true" : undefined}>
            Синий
          </a>
        </div>
        <div className="grp">
          <span>Интервал:</span>
          {([0, 1, 2] as const).map((n) => (
            <a key={n} href={link(`ls=${n}`)} aria-current={a.ls === n ? "true" : undefined}>
              {["Обычный", "Средний", "Большой"][n]}
            </a>
          ))}
        </div>
        <div className="grp">
          <span>Изображения:</span>
          <a href={link(`img=${a.images ? 0 : 1}`)}>{a.images ? "Выключить" : "Включить"}</a>
        </div>
        <div className="grp">
          <a href={`/a11y/off?back=${back}`}>Обычная версия</a>
        </div>
      </div>
    </div>
  );
}

function Footer({ ctx }: { ctx: SiteCtx }) {
  const c = ctx.settings.contacts;
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Logo />
            <p style={{ marginTop: 18, maxWidth: 360 }}>
              Организуем медицинские конгрессы, научные конференции, семинары и выставки — с заботой о каждом участнике.
            </p>
            {c.socials.vk || c.socials.telegram || c.socials.youtube ? (
              <div className="socials">
                {c.socials.vk ? (
                  <a href={c.socials.vk} rel="noopener" target="_blank" aria-label="ВКонтакте">
                    VK
                  </a>
                ) : null}
                {c.socials.telegram ? (
                  <a href={c.socials.telegram} rel="noopener" target="_blank" aria-label="Telegram">
                    TG
                  </a>
                ) : null}
                {c.socials.youtube ? (
                  <a href={c.socials.youtube} rel="noopener" target="_blank" aria-label="YouTube">
                    YT
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          <div>
            <h4>Мероприятия</h4>
            <ul>
              <li>
                <a href="/events">Предстоящие</a>
              </li>
              <li>
                <a href="/events?tab=archive">Архив</a>
              </li>
              <li>
                <a href="/events?format=ONLINE_SYMPOSIUM">Онлайн-симпозиумы</a>
              </li>
              <li>
                <a href="/news">Новости</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Компания</h4>
            <ul>
              <li>
                <a href={ctx.href("about")}>О компании</a>
              </li>
              <li>
                <a href={ctx.href("contacts")}>Контакты</a>
              </li>
              <li>
                <a href="/sveden">Сведения об образовательной организации</a>
              </li>
              <li>
                <a href={ctx.href("search")}>Поиск по сайту</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Контакты</h4>
            <ul>
              {c.headerPhone ? (
                <li>
                  <a href={phoneHref(c.headerPhone)}>{c.headerPhone}</a>
                </li>
              ) : null}
              {c.phones
                .filter((p) => p.number !== c.headerPhone)
                .slice(0, 2)
                .map((p) => (
                  <li key={p.number}>
                    <a href={phoneHref(p.number)}>{formatPhone(p.number)}</a>
                  </li>
                ))}
              {c.emails.slice(0, 2).map((e) => (
                <li key={e.email}>
                  <a href={`mailto:${e.email}`}>{e.email}</a>
                </li>
              ))}
              {c.address ? <li className="muted">{c.address}</li> : null}
            </ul>
          </div>
        </div>
        <div className="fbot">
          <span>© {year} ООО «МедиаЭкспоГрупп»</span>
          <span>
            <a href={ctx.href("privacy")}>Политика конфиденциальности</a> · <a href={ctx.href("consent")}>Согласие на обработку ПДн</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
