import type { ReactNode } from "react";
import type { EventFormat } from "../generated/prisma/client.js";
import type { SiteCtx } from "./context.js";
import { dateBadge, dateRange, fileSize, formatLabels, initials, newsDate, paragraphs } from "./format.js";
import { CoverIllustration } from "./icons.js";
import { config } from "../config.js";

export function bg(url: string | null | undefined, images = true) {
  return url && images ? { backgroundImage: `url("${url}")` } : undefined;
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a>
      {items.map((i, n) => (
        <span key={n}>
          {" / "}
          {i.href ? <a href={i.href}>{i.label}</a> : <span aria-current="page">{i.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function crumbsLd(ctx: SiteCtx, items: { href?: string; label: string }[]) {
  const all = [{ href: "/", label: "Главная" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((i, n) => ({
      "@type": "ListItem",
      position: n + 1,
      name: i.label,
      item: `${ctx.origin}${i.href ?? ctx.path}`,
    })),
  };
}

export function SectionHead({ eyebrow, title, lead, action, center }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; action?: ReactNode; center?: boolean }) {
  return (
    <div className={`shead${center ? " center" : ""}`} style={center ? { justifyContent: "center" } : undefined}>
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Paras({ text, className }: { text: string | null | undefined; className?: string }) {
  const ps = paragraphs(text);
  if (!ps.length) return null;
  return (
    <div className={className}>
      {ps.map((p, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>
          {p}
        </p>
      ))}
    </div>
  );
}

export type EventCardData = {
  title: string;
  slug: string;
  format?: EventFormat;
  startDate: string;
  endDate: string;
  dateUnknown?: boolean;
  city: string | null;
  venueName?: string | null;
  nmoPoints?: number | null;
  coverThumbUrl: string | null;
  open?: boolean;
  isPast?: boolean;
};

export function EventCard({ e, ctx }: { e: EventCardData; ctx: SiteCtx }) {
  const d = dateBadge(e.startDate, e.dateUnknown);
  const format = e.format ?? "CONGRESS";
  return (
    <a className="ecard" href={`/events/${e.slug}`}>
      <div className="ecard-img" style={bg(e.coverThumbUrl, ctx.a11y.images || !ctx.a11y.on)}>
        {!e.coverThumbUrl ? <CoverIllustration format={format} /> : null}
        <div className={e.dateUnknown ? "ecard-date ecard-year" : "ecard-date"}>
          <b>{d.day}</b>
          <span>{d.month}</span>
        </div>
        {e.open ? <span className="chip chip-mint ecard-badge">Регистрация открыта</span> : null}
      </div>
      <div className="ecard-body">
        <div className="chips">
          {e.format ? <span className="chip">{formatLabels[e.format]}</span> : null}
          {e.nmoPoints ? <span className="chip chip-mint">✚ {e.nmoPoints} НМО</span> : null}
        </div>
        <h3>{e.title}</h3>
        <div className="meta">
          <span>{dateRange(e.startDate, e.endDate, e.dateUnknown)}</span>
          {e.city || e.venueName ? <span>{[e.city, e.venueName].filter(Boolean).join(", ")}</span> : null}
        </div>
      </div>
    </a>
  );
}

export type NewsCardData = { title: string; slug: string; excerpt: string | null; coverThumbUrl: string | null; publishAt: Date | null };

export function NewsCard({ n, ctx }: { n: NewsCardData; ctx: SiteCtx }) {
  return (
    <a className="ncard" href={`/news/${n.slug}`}>
      <div className="ncard-img" style={bg(n.coverThumbUrl, ctx.a11y.images || !ctx.a11y.on)} />
      <div className="ncard-body">
        <time dateTime={n.publishAt?.toISOString()}>{newsDate(n.publishAt, config.TIMEZONE)}</time>
        <h3>{n.title}</h3>
        {n.excerpt ? <p>{n.excerpt}</p> : null}
      </div>
    </a>
  );
}

export function Avatar({ name, url }: { name: string; url?: string | null }) {
  return (
    <span className="avatar" style={bg(url)} aria-hidden="true">
      {url ? null : initials(name)}
    </span>
  );
}

export type Review = { quote: string; name: string; position: string | null; photoThumbUrl: string | null };

export function Reviews({ items }: { items: Review[] }) {
  return (
    <div className="reviews">
      {items.map((r, i) => (
        <figure className="review" key={i} style={{ margin: 0 }}>
          <span className="qq" aria-hidden="true">
            “
          </span>
          <blockquote>{r.quote}</blockquote>
          <figcaption className="person">
            <Avatar name={r.name} url={r.photoThumbUrl} />
            <span>
              <b>{r.name}</b>
              {r.position ? <span>{r.position}</span> : null}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export type PartnerData = { name: string; url: string | null; logoThumbUrl: string | null };

export function PartnerTile({ p, size }: { p: PartnerData; size?: "lg" | "sm" }) {
  const cls = `partner${size ? ` partner-${size}` : ""}`;
  const inner = p.logoThumbUrl ? <img src={p.logoThumbUrl} alt={p.name} loading="lazy" /> : <span>{p.name}</span>;
  return p.url ? (
    <a className={cls} href={p.url} target="_blank" rel="noopener" title={p.name}>
      {inner}
    </a>
  ) : (
    <div className={cls} title={p.name}>
      {inner}
    </div>
  );
}

export function Stats({ items }: { items: { value: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="stats" style={{ ["--cols" as string]: Math.min(items.length, 6) }}>
      {items.map((s, i) => (
        <div className="stat" key={i}>
          <b>{s.value}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export type DocData = { title: string; description: string | null; url: string; extension: string; size: number; fileUpdatedAt: Date };

export function DocItem({ d, itemprop }: { d: DocData; itemprop?: string }) {
  const ext = d.extension.toUpperCase();
  const cls = ext.startsWith("XLS") ? "ic x" : ext.startsWith("DOC") ? "ic w" : "ic";
  return (
    <a className="doc" href={d.url} itemProp={itemprop} target={ext === "PDF" ? "_blank" : undefined} rel={ext === "PDF" ? "noopener" : undefined}>
      <span className={cls} aria-hidden="true">
        {ext}
      </span>
      <div>
        <b>{d.title}</b>
        <span>
          {ext} · {fileSize(d.size)} · обновлено {new Intl.DateTimeFormat("ru-RU", { timeZone: config.TIMEZONE }).format(d.fileUpdatedAt)}
          {d.description ? ` · ${d.description}` : ""}
        </span>
      </div>
      <span className="dl" aria-hidden="true">
        ↓
      </span>
    </a>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const list = [...set].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1]! > 1) out.push(<span key={`g${p}`} className="gap">…</span>);
    out.push(
      p === page ? (
        <span key={p} aria-current="page">
          {p}
        </span>
      ) : (
        <a key={p} href={href(p)}>
          {p}
        </a>
      ),
    );
  });
  return (
    <nav className="pager" aria-label="Страницы">
      {page > 1 ? (
        <a href={href(page - 1)} aria-label="Предыдущая страница">
          ←
        </a>
      ) : null}
      {out}
      {page < pages ? (
        <a href={href(page + 1)} aria-label="Следующая страница">
          →
        </a>
      ) : null}
    </nav>
  );
}

export function Field({ name, label, required, children, hint }: { name: string; label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="field" data-field={name}>
      <label htmlFor={`f-${name}`}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
      <span className="ferr" id={`e-${name}`} />
    </div>
  );
}

export function ConsentCheck({ ctx, name = "consent" }: { ctx: SiteCtx; name?: string }) {
  return (
    <div className="field" data-field={name} style={{ marginBottom: 6 }}>
      <label className="check">
        <input type="checkbox" name={name} value="true" required />
        <span>
          Согласен(на) на обработку персональных данных в соответствии с{" "}
          <a href={ctx.href("consent")} target="_blank">
            согласием
          </a>{" "}
          и{" "}
          <a href={ctx.href("privacy")} target="_blank">
            политикой конфиденциальности
          </a>
        </span>
      </label>
      <span className="ferr" />
    </div>
  );
}

export function ContactForm({ ctx, source, title = "Оставить заявку", compact }: { ctx: SiteCtx; source: string; title?: string; compact?: boolean }) {
  return (
    <form className="js-form" method="post" action="/api/public/contact-requests" data-thanks={ctx.href("thanks")} noValidate>
      {title ? <h3>{title}</h3> : null}
      {!compact ? <p className="muted" style={{ fontSize: ".94rem" }}>Ответим в течение рабочего дня.</p> : null}
      <div className="form-msg err" role="alert" />
      <input type="hidden" name="source" value={source} />
      <div className="hp" aria-hidden="true">
        <label>
          Сайт
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field name="name" label="Ваше имя" required>
        <input className="input" id="f-name" name="name" autoComplete="name" required maxLength={120} />
      </Field>
      <Field name="organization" label="Организация">
        <input className="input" id="f-organization" name="organization" autoComplete="organization" maxLength={200} />
      </Field>
      <div className="row2">
        <Field name="phone" label="Телефон">
          <input className="input" id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (900) 000-00-00" />
        </Field>
        <Field name="email" label="E-mail">
          <input className="input" id="f-email" name="email" type="email" inputMode="email" autoComplete="email" />
        </Field>
      </div>
      <Field name="comment" label="Комментарий">
        <textarea className="textarea" id="f-comment" name="comment" maxLength={3000} placeholder="Расскажите о мероприятии: формат, даты, число участников" />
      </Field>
      <ConsentCheck ctx={ctx} />
      <button className="btn btn-block" type="submit">
        Отправить заявку
      </button>
    </form>
  );
}
