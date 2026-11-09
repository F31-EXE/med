import { config } from "../../config.js";
import { loadPublicEvent, type PublicEvent } from "../../routes/publicEvents.js";
import type { SiteCtx } from "../context.js";
import { dateRange, dayLabel, formatLabels, lines, modeLabels, num, paragraphs, participationLabels, partnerLevelLabels, plural, rub, speakerRoleLabels, truncate } from "../format.js";
import { CoverIllustration, Icon } from "../icons.js";
import { titleOf, type View } from "../render.js";
import { bg, ConsentCheck, Crumbs, crumbsLd, DocItem, EventCard, Field, PartnerTile, Stats } from "../ui.js";

type Ev = PublicEvent["event"];

function tzOffsetMinutes(dateIso: string) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: config.TIMEZONE, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return Math.round((local - d.getTime()) / 60000);
}

function startMoment(e: Ev) {
  const first = e.program[0]?.sessions[0]?.startTime ?? "09:00";
  const [h, m] = first.split(":").map(Number);
  const utc = Date.parse(`${e.startDate}T00:00:00Z`) + ((h ?? 9) * 60 + (m ?? 0) - tzOffsetMinutes(e.startDate)) * 60000;
  return utc;
}

function Countdown({ target }: { target: number }) {
  const diff = Math.max(0, target - Date.now());
  const d = Math.floor(diff / 864e5);
  const h = Math.floor((diff % 864e5) / 36e5);
  const m = Math.floor((diff % 36e5) / 6e4);
  return (
    <div className="count4" data-countdown={target} aria-label={`До начала ${d} ${plural(d, "день", "дня", "дней")}`}>
      <div>
        <strong data-cd="d">{d}</strong>
        <span>{plural(d, "день", "дня", "дней")}</span>
      </div>
      <div>
        <strong data-cd="h">{String(h).padStart(2, "0")}</strong>
        <span>часов</span>
      </div>
      <div>
        <strong data-cd="m">{String(m).padStart(2, "0")}</strong>
        <span>минут</span>
      </div>
      <div>
        <strong data-cd="s">00</strong>
        <span>секунд</span>
      </div>
    </div>
  );
}

function RegCard({ e, hasResults }: { e: Ev; hasResults: boolean }) {
  const r = e.registration;
  const pct = r.limit ? Math.min(100, Math.round((r.taken / r.limit) * 100)) : 0;
  return (
    <div className="regcard">
      {!e.isPast ? (
        <>
          <div className="t">До начала</div>
          <Countdown target={startMoment(e)} />
        </>
      ) : (
        <div className="t" style={{ marginBottom: 12 }}>
          Мероприятие завершено
        </div>
      )}
      {r.showCount && r.limit ? (
        <>
          <div className="rrow">
            <span>Зарегистрировано</span>
            <b>
              {num(r.taken)} / {num(r.limit)}
            </b>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : r.showCount ? (
        <div className="rrow" style={{ marginBottom: 16 }}>
          <span>Зарегистрировано</span>
          <b>{num(r.taken)}</b>
        </div>
      ) : null}
      {e.isPast ? (
        hasResults ? (
          <a className="btn btn-block btn-ghost" href="#results">
            Итоги мероприятия
          </a>
        ) : null
      ) : r.open ? (
        <a className="btn btn-block" href="#registration">
          Зарегистрироваться
        </a>
      ) : (
        <span className="btn btn-block btn-ghost" aria-disabled="true">
          {r.reason === "full" ? "Все места заняты" : "Регистрация закрыта"}
        </span>
      )}
      <small>{r.open ? (e.tariffs.some((t) => t.price === 0) ? "Для врачей участие бесплатное · " : "") + "подтверждение придёт на e-mail" : "Следите за новостями мероприятия"}</small>
    </div>
  );
}

function Program({ e }: { e: Ev }) {
  const halls = e.halls;
  const hallName = new Map(halls.map((h) => [h.id, h.name]));
  return (
    <div className="js-program">
      {e.program.length > 1 ? (
        <div className="prog-days" role="tablist" aria-label="Дни программы">
          {e.program.map((d, i) => {
            const l = dayLabel(d.date);
            return (
              <button key={d.id} type="button" role="tab" id={`tab-${d.id}`} aria-controls={`day-${d.id}`} aria-selected={i === 0 ? "true" : "false"} data-day={d.id}>
                <b>{d.title ?? `День ${i + 1}`}</b>
                <span>
                  {l.date}, {l.weekday}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {halls.length > 1 ? (
        <div className="prog-halls" role="group" aria-label="Фильтр по залам">
          Зал:
          <button type="button" aria-pressed="true" data-hall="">
            Все залы
          </button>
          {halls.map((h) => (
            <button key={h.id} type="button" aria-pressed="false" data-hall={h.id}>
              {h.name}
            </button>
          ))}
        </div>
      ) : null}
      {e.program.map((d, i) => {
        const l = dayLabel(d.date);
        return (
          <div className="day-panel" key={d.id} id={`day-${d.id}`} role={e.program.length > 1 ? "tabpanel" : undefined} aria-labelledby={e.program.length > 1 ? `tab-${d.id}` : undefined} hidden={i > 0}>
            <div className="day-title">
              {d.title ?? `День ${i + 1}`} · {l.date}, {l.weekday}
            </div>
            <div className="sched">
              {d.sessions.map((s) =>
                s.kind === "BREAK" ? (
                  <div className="slot brk" key={s.id} data-hall={s.hallId ?? ""}>
                    <div className="tm">{s.startTime}</div>
                    <h4>{s.title}</h4>
                  </div>
                ) : (
                  <div className={`slot${s.nmo ? " nmo" : ""}`} key={s.id} data-hall={s.hallId ?? ""}>
                    <div className="tm">
                      {s.startTime}
                      <small>– {s.endTime}</small>
                    </div>
                    <div>
                      <h4>{s.title}</h4>
                      {s.description ? <p>{s.description}</p> : null}
                      {s.speakers.length ? (
                        <div className="sp" style={{ marginTop: 8 }}>
                          {s.speakers.filter((x) => x.role === "MODERATOR").length ? (
                            <div>
                              Модераторы:{" "}
                              <b>
                                {s.speakers
                                  .filter((x) => x.role === "MODERATOR")
                                  .map((x) => x.fullName)
                                  .join(", ")}
                              </b>
                            </div>
                          ) : null}
                          {s.speakers.filter((x) => x.role !== "MODERATOR").length ? (
                            <div>
                              Докладчики:{" "}
                              <b>
                                {s.speakers
                                  .filter((x) => x.role !== "MODERATOR")
                                  .map((x) => x.fullName)
                                  .join(", ")}
                              </b>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="right tags">
                      {s.hallId && hallName.get(s.hallId) ? <span className="chip">{hallName.get(s.hallId)}</span> : <span className="chip chip-muted">Все залы</span>}
                      {s.nmo ? <span className="chip chip-mint">✚ НМО</span> : null}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RegistrationForm({ ctx, e }: { ctx: SiteCtx; e: Ev }) {
  const r = e.registration;
  const f = r.fields;
  return (
    <form className="regform js-form" method="post" action={`/api/public/events/${e.slug}/registrations`} data-thanks={ctx.href("thanks")} data-kind="registration" noValidate>
      <h4>Регистрация участника</h4>
      <p className="hint" style={{ marginBottom: 16 }}>
        Поля, отмеченные *, обязательны
      </p>
      <div className="form-msg err" role="alert" />
      <div className="hp" aria-hidden="true">
        <label>
          Сайт
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="row2">
        <Field name="lastName" label="Фамилия" required>
          <input className="input" id="f-lastName" name="lastName" autoComplete="family-name" required maxLength={60} />
        </Field>
        <Field name="firstName" label="Имя" required>
          <input className="input" id="f-firstName" name="firstName" autoComplete="given-name" required maxLength={60} />
        </Field>
      </div>
      {f.middleName ? (
        <Field name="middleName" label="Отчество">
          <input className="input" id="f-middleName" name="middleName" autoComplete="additional-name" maxLength={60} />
        </Field>
      ) : null}
      <div className="row2">
        <Field name="email" label="E-mail" required>
          <input className="input" id="f-email" name="email" type="email" inputMode="email" autoComplete="email" required />
        </Field>
        <Field name="phone" label="Телефон" required>
          <input className="input" id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (900) 000-00-00" required />
        </Field>
      </div>
      <Field name="specialtyId" label="Специальность" required>
        <select className="select" id="f-specialtyId" name="specialtyId" required defaultValue="">
          <option value="" disabled>
            Выберите из списка
          </option>
          {r.specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      {f.workplace || f.position ? (
        <div className="row2">
          {f.workplace ? (
            <Field name="workplace" label="Место работы">
              <input className="input" id="f-workplace" name="workplace" autoComplete="organization" maxLength={300} />
            </Field>
          ) : null}
          {f.position ? (
            <Field name="position" label="Должность">
              <input className="input" id="f-position" name="position" autoComplete="organization-title" maxLength={200} />
            </Field>
          ) : null}
        </div>
      ) : null}
      <Field name="city" label="Город" required>
        <input className="input" id="f-city" name="city" autoComplete="address-level2" required maxLength={100} />
      </Field>
      {f.snils ? (
        <Field name="snils" label="СНИЛС" hint="Нужен для начисления баллов НМО">
          <input className="input" id="f-snils" name="snils" inputMode="numeric" placeholder="000-000-000 00" />
        </Field>
      ) : null}
      <div className="field" data-field="format">
        <span className="label">
          Формат участия <span className="req">*</span>
        </span>
        <div className={`choice${r.formats.length > 1 ? " two" : ""}`} role="radiogroup">
          {r.formats.map((fm, i) => (
            <label key={fm}>
              <input type="radio" name="format" value={fm} defaultChecked={i === 0} />
              {participationLabels[fm] ?? fm}
            </label>
          ))}
        </div>
        <span className="ferr" />
      </div>
      <ConsentCheck ctx={ctx} name="consentPersonalData" />
      {f.mailingConsent ? (
        <label className="check">
          <input type="checkbox" name="consentMailing" value="true" />
          <span>Хочу получать анонсы мероприятий на e-mail</span>
        </label>
      ) : null}
      <button className="btn btn-block" type="submit">
        Зарегистрироваться
      </button>
      <noscript>
        <p className="hint" style={{ marginTop: 10 }}>
          Для отправки формы включите JavaScript в браузере.
        </p>
      </noscript>
    </form>
  );
}

function mapUrl(e: Ev) {
  const v = e.venue;
  if (v.lat !== null && v.lng !== null) return `https://yandex.ru/map-widget/v1/?ll=${v.lng},${v.lat}&z=16&pt=${v.lng},${v.lat},pm2rdm`;
  const text = [e.city, v.address].filter(Boolean).join(", ");
  return text ? `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(text)}&z=15` : null;
}

function mapLink(e: Ev) {
  const v = e.venue;
  if (v.lat !== null && v.lng !== null) return `https://yandex.ru/maps/?pt=${v.lng},${v.lat}&z=16&l=map`;
  return `https://yandex.ru/maps/?text=${encodeURIComponent([e.city, v.address].filter(Boolean).join(", "))}`;
}

function eventLd(ctx: SiteCtx, e: Ev) {
  const attendance = e.attendanceMode === "ONLINE" ? "OnlineEventAttendanceMode" : e.attendanceMode === "HYBRID" ? "MixedEventAttendanceMode" : "OfflineEventAttendanceMode";
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.description ? truncate(e.description, 300) : (e.subtitle ?? undefined),
    startDate: e.startDate,
    endDate: e.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: `https://schema.org/${attendance}`,
    image: e.coverUrl ? [`${ctx.origin}${e.coverUrl}`] : undefined,
    url: `${ctx.origin}/events/${e.slug}`,
    location:
      e.attendanceMode === "ONLINE"
        ? { "@type": "VirtualLocation", url: `${ctx.origin}/events/${e.slug}` }
        : { "@type": "Place", name: e.venue.name ?? e.city ?? undefined, address: [e.city, e.venue.address].filter(Boolean).join(", ") || undefined },
    organizer: { "@type": "Organization", name: "Media Expo Group", url: ctx.origin },
    offers: e.tariffs.length
      ? e.tariffs.map((t) => ({ "@type": "Offer", name: t.name, price: t.price ?? undefined, priceCurrency: "RUB", url: `${ctx.origin}/events/${e.slug}#registration` }))
      : undefined,
  };
}

export async function eventView(ctx: SiteCtx, slug: string): Promise<View | null> {
  const data = await loadPublicEvent(slug);
  if (!data) return null;
  const e = data.event;
  const r = e.registration;
  const keyFacts = (Array.isArray(e.keyFacts) ? e.keyFacts : []) as { value: string; label: string }[];
  const images = ctx.a11y.images || !ctx.a11y.on;
  const mainDocs = e.documents;
  const programDoc = mainDocs.find((d) => /программ/i.test(d.title));
  const partnersByLevel: { key: string; label: string; items: typeof e.partners }[] = [];
  for (const lvl of ["ORGANIZER", "GENERAL", "OFFICIAL", "INFO"] as const) {
    for (const p of e.partners.filter((x) => x.level === lvl)) {
      const label = p.groupTitle ?? partnerLevelLabels[lvl];
      const key = `${lvl}|${label}`;
      const g = partnersByLevel.find((x) => x.key === key);
      if (g) g.items.push(p);
      else partnersByLevel.push({ key, label, items: [p] });
    }
  }
  const hasVenue = !!(e.venue.name || e.venue.address);
  const map = mapUrl(e);
  const res = e.results;
  const hasResults = !!(
    res &&
    (res.text?.trim() ||
      (res.facts as unknown[]).length ||
      res.images.length ||
      (res.links as unknown[]).length ||
      res.materials.length)
  );

  const sections = [
    { id: "about", label: "О мероприятии", on: !!(e.description || keyFacts.length || e.directions.length) },
    { id: "program", label: "Программа", on: e.program.some((d) => d.sessions.length) },
    { id: "speakers", label: "Спикеры", on: e.speakers.length > 0 },
    { id: "venue", label: "Площадка", on: hasVenue },
    { id: "conditions", label: "Условия участия", on: e.tariffs.length > 0 },
    e.isPast ? { id: "results", label: "Итоги", on: hasResults } : { id: "registration", label: "Регистрация", on: true },
    { id: "partners", label: "Партнёры", on: partnersByLevel.length > 0 },
    { id: "documents", label: "Документы", on: mainDocs.length > 0 },
  ].filter((s) => s.on);

  const crumbs = [{ href: "/events", label: "Мероприятия" }, { label: e.title }];
  const customLabels = new Set(keyFacts.map((f) => f.label.trim().toLowerCase()));
  const facts: { label: string; value: string }[] = [
    { label: "Формат", value: `${formatLabels[e.format]} · ${modeLabels[e.attendanceMode]}` },
    ...(e.nmoPoints ? [{ label: "Баллы НМО", value: String(e.nmoPoints) }] : []),
    ...(e.expectedParticipants ? [{ label: "Участников", value: num(e.expectedParticipants) }] : []),
  ].filter((f) => !customLabels.has(f.label.toLowerCase()));
  facts.push(...keyFacts.map((f) => ({ label: f.label, value: f.value })));

  return {
    meta: {
      title: e.seoTitle ?? titleOf(ctx, `${e.title} — ${dateRange(e.startDate, e.endDate, e.dateUnknown)}${e.city ? `, ${e.city}` : ""}`),
      description: e.seoDescription ?? truncate(e.subtitle ?? e.description ?? `${formatLabels[e.format]} ${dateRange(e.startDate, e.endDate, e.dateUnknown)}${e.city ? `, ${e.city}` : ""}. Программа, спикеры, регистрация.`, 200),
      image: e.coverUrl,
      canonical: `/events/${e.slug}`,
      jsonLd: [...(e.dateUnknown ? [] : [eventLd(ctx, e)]), crumbsLd(ctx, [{ href: "/events", label: "Мероприятия" }, { href: `/events/${e.slug}`, label: e.title }])],
      stickyReg: r.open && !e.isPast ? "#registration" : undefined,
    },
    body: (
      <>
        <section className="ev-hero">
          <div className="wrap">
            <Crumbs items={crumbs} />
            <div className="ev-grid" style={{ marginTop: 26 }}>
              <div className="ev-main">
                <div className="chips">
                  <span className="chip chip-ink">{formatLabels[e.format]}</span>
                  {e.directions.slice(0, 2).map((d) => (
                    <span className="chip" key={d}>
                      {d}
                    </span>
                  ))}
                  {e.nmoPoints ? <span className="chip chip-mint">✚ {e.nmoPoints} {plural(e.nmoPoints, "балл", "балла", "баллов")} НМО</span> : null}
                  <span className="chip">{modeLabels[e.attendanceMode]}</span>
                  {e.isPast ? <span className="chip chip-muted">Завершено</span> : r.open ? <span className="chip chip-mint">Регистрация открыта</span> : null}
                </div>
                <h1>{e.title}</h1>
                {e.subtitle ? <p className="sub">{e.subtitle}</p> : null}
              </div>
              <div className="ev-meta">
                <div className="meta3">
                  <div>
                    <span className="ico">
                      <Icon.calendar />
                    </span>
                    <div>
                      <span>Даты</span>
                      <strong>{dateRange(e.startDate, e.endDate, e.dateUnknown)}</strong>
                    </div>
                  </div>
                  <div>
                    <span className="ico">
                      <Icon.pin />
                    </span>
                    <div>
                      <span>Место</span>
                      <strong>{e.attendanceMode === "ONLINE" ? "Онлайн" : [e.city, e.venue.name].filter(Boolean).join(", ") || "Уточняется"}</strong>
                    </div>
                  </div>
                  <div>
                    <span className="ico">
                      <Icon.users />
                    </span>
                    <div>
                      <span>Участники</span>
                      <strong>
                        {e.expectedParticipants ? `${num(e.expectedParticipants)} ${plural(e.expectedParticipants, "участник", "участника", "участников")}` : "Врачи и медработники"}
                        {e.speakers.length ? `, ${e.speakers.length} ${plural(e.speakers.length, "спикер", "спикера", "спикеров")}` : ""}
                      </strong>
                    </div>
                  </div>
                </div>
                <div className="ev-actions">
                  {r.open && !e.isPast ? (
                    <a className="btn" href="#registration">
                      Зарегистрироваться →
                    </a>
                  ) : null}
                  {programDoc ? (
                    <a className="btn btn-ghost" href={programDoc.url}>
                      ↓ Программа ({programDoc.extension.toUpperCase()})
                    </a>
                  ) : e.program.length ? (
                    <a className="btn btn-ghost" href="#program">
                      Смотреть программу
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="ev-side">
                <div className="ev-cover" style={bg(e.coverUrl, images)}>
                  {!e.coverUrl ? <CoverIllustration format={e.format} /> : null}
                </div>
                <RegCard e={e} hasResults={hasResults} />
              </div>
            </div>
          </div>
        </section>

        {sections.length > 1 ? (
          <nav className="anchors" aria-label="Разделы страницы">
            <div className="wrap">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {s.label}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        {sections.some((s) => s.id === "about") ? (
          <section className="ev-sec" id="about">
            <div className="wrap ev-about">
              <div>
                <span className="eyebrow">О мероприятии</span>
                <h2 style={{ margin: "14px 0 18px" }}>{e.subtitle ? "О мероприятии" : e.title}</h2>
                <div className="prose">
                  {paragraphs(e.description).map((p, i) => (
                    <p key={i} style={{ whiteSpace: "pre-line" }}>
                      {p}
                    </p>
                  ))}
                </div>
                {e.directions.length ? (
                  <div className="dirs">
                    {e.directions.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <aside className="facts">
                <h3>Ключевые факты</h3>
                {facts.map((f, i) => (
                  <div className="fact" key={i}>
                    <span>{f.label}</span>
                    <b>{f.value}</b>
                  </div>
                ))}
                {e.organizers ? (
                  <div className="orgs">
                    <span>Организаторы</span>
                    {lines(e.organizers).map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        {sections.some((s) => s.id === "program") ? (
          <section className="ev-sec section-soft" id="program" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Программа</span>
                  <h2>Научная программа</h2>
                  <p className="lead">Программа может уточняться — следите за обновлениями.</p>
                </div>
                {programDoc ? (
                  <a className="btn btn-ghost" href={programDoc.url}>
                    ↓ Скачать программу
                  </a>
                ) : null}
              </div>
              <Program e={e} />
            </div>
          </section>
        ) : null}

        {e.speakers.length ? (
          <section className="ev-sec" id="speakers" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Спикеры</span>
                  <h2>
                    {e.speakers.length} {plural(e.speakers.length, "эксперт", "эксперта", "экспертов")}
                  </h2>
                </div>
              </div>
              <div className="spk-grid">
                {e.speakers.map((s) => (
                  <div className="spk" key={s.id}>
                    <div className="ph" style={bg(s.photoThumbUrl, images)}>
                      {s.role !== "SPEAKER" ? <span className="role">{speakerRoleLabels[s.role]}</span> : null}
                      {!s.photoThumbUrl ? s.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("") : null}
                    </div>
                    <b>{s.fullName}</b>
                    <span>{[s.degree, s.position].filter(Boolean).join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {hasVenue ? (
          <section className="ev-sec section-soft" id="venue" style={{ paddingTop: 56 }}>
            <div className="wrap venue">
              <div className="vinfo">
                <span className="eyebrow">Площадка</span>
                <h3>{e.venue.name ?? e.city}</h3>
                <p className="muted">{[e.city, e.venue.address].filter(Boolean).join(", ")}</p>
                {e.venue.howToGet ? (
                  <div className="vrow">
                    <span className="ico">
                      <Icon.route />
                    </span>
                    <div>
                      <strong>Как добраться</strong>
                      <span>{e.venue.howToGet}</span>
                    </div>
                  </div>
                ) : null}
                {e.venue.parking ? (
                  <div className="vrow">
                    <span className="ico">
                      <Icon.car />
                    </span>
                    <div>
                      <strong>Парковка</strong>
                      <span>{e.venue.parking}</span>
                    </div>
                  </div>
                ) : null}
                {e.venue.accommodation ? (
                  <div className="vrow">
                    <span className="ico">
                      <Icon.bed />
                    </span>
                    <div>
                      <strong>Проживание</strong>
                      <span>{e.venue.accommodation}</span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="map">
                <div className="map-fallback">
                  <a href={mapLink(e)} target="_blank" rel="noopener">
                    Открыть на Яндекс.Картах ↗
                  </a>
                </div>
                {map && images ? <iframe src={map} title={`Карта: ${e.venue.name ?? e.venue.address ?? ""}`} loading="lazy" data-map /> : null}
              </div>
            </div>
          </section>
        ) : null}

        {e.tariffs.length ? (
          <section className="ev-sec" id="conditions" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Условия участия</span>
                  <h2>Выберите формат участия</h2>
                </div>
              </div>
              <div className="tariffs" style={{ ["--cols" as string]: Math.min(e.tariffs.length, 4) }}>
                {e.tariffs.map((t, i) => {
                  const featured = e.tariffs.length > 2 && i === 1;
                  return (
                    <div className={`tf${featured ? " on" : ""}`} key={i}>
                      {featured ? <span className="chip chip-ink badge">Популярный выбор</span> : null}
                      <h4>{t.name}</h4>
                      <div className="who">{t.audience ?? " "}</div>
                      <div className="pr">{rub(t.price)}</div>
                      <ul>
                        {lines(t.includes).map((l, n) => (
                          <li key={n}>{l.replace(/^[-–•]\s*/, "")}</li>
                        ))}
                      </ul>
                      {r.open && !e.isPast ? (
                        <a className={`btn btn-block${featured ? "" : " btn-ghost"}`} href="#registration">
                          Зарегистрироваться
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {e.isPast && e.results && hasResults ? (
          <section className="ev-sec" id="results" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Итоги</span>
                  <h2>Итоги мероприятия</h2>
                </div>
              </div>
              <div className="prose">
                {paragraphs(e.results.text).map((p, i) => (
                  <p key={i} style={{ whiteSpace: "pre-line" }}>
                    {p}
                  </p>
                ))}
              </div>
              <Stats items={e.results.facts as { value: string; label: string }[]} />
              {e.results.images.length && images ? (
                <div className="gallery" style={{ marginTop: 28 }}>
                  {e.results.images.map((im, i) => (
                    <figure key={i}>
                      <a href={im.url} target="_blank" style={{ backgroundImage: `url("${im.thumbUrl}")` }} aria-label={im.caption ?? `Фото ${i + 1}`} />
                      {im.caption ? <figcaption>{im.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : null}
              {(e.results.links as { title: string; url: string }[]).length ? (
                <div className="res-links">
                  <h3 style={{ marginTop: 20 }}>Публикации и видео</h3>
                  {(e.results.links as { title: string; url: string }[]).map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noopener">
                      {l.title} ↗
                    </a>
                  ))}
                </div>
              ) : null}
              {e.results.materials.length ? (
                <>
                  <h3 style={{ margin: "28px 0 14px" }}>Материалы докладов</h3>
                  <div className="docs two">
                    {e.results.materials.map((d) => (
                      <DocItem key={d.url} d={d} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : !e.isPast ? (
          <section className="ev-sec" id="registration" style={{ paddingTop: e.tariffs.length ? 0 : 56 }}>
            <div className="wrap">
              <div className="regbox" id="registration-box">
                <div>
                  <h3>{r.open ? "Онлайн-регистрация" : "Регистрация"}</h3>
                  {r.open ? (
                    <>
                      <p>Заполните анкету — это займёт пару минут. Подтверждение придёт на e-mail.</p>
                      <div className="regsteps">
                        <div>
                          <b>1</b>Заполните анкету участника
                        </div>
                        <div>
                          <b>2</b>Получите письмо-подтверждение
                        </div>
                        <div>
                          <b>3</b>Приходите на мероприятие или подключайтесь онлайн
                        </div>
                      </div>
                    </>
                  ) : (
                    <p>По вопросам участия свяжитесь с организаторами.</p>
                  )}
                </div>
                {r.open ? (
                  <RegistrationForm ctx={ctx} e={e} />
                ) : (
                  <div className="regclosed">
                    <h4>{r.reason === "full" ? "Регистрация завершена: все места заняты" : "Регистрация завершена"}</h4>
                    <p className="muted">Следите за новостями мероприятия или напишите нам.</p>
                    <a className="btn btn-ghost" href={`${ctx.href("contacts")}#form`}>
                      Связаться с нами
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {partnersByLevel.length ? (
          <section className="ev-sec" id="partners" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Партнёры</span>
                  <h2>Партнёры мероприятия</h2>
                </div>
              </div>
              {partnersByLevel.map((g) => (
                <div className="ptier" key={g.key}>
                  <span>{g.label}</span>
                  <div className="partners">
                    {g.items.map((p) => (
                      <PartnerTile key={p.name} p={p} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {mainDocs.length ? (
          <section className="ev-sec section-soft" id="documents" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Документы</span>
                  <h2>Документы и материалы</h2>
                </div>
              </div>
              <div className="docs two">
                {mainDocs.map((d) => (
                  <DocItem key={d.url} d={d} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {data.others.length ? (
          <section className="ev-sec" style={{ paddingTop: 56 }}>
            <div className="wrap">
              <div className="shead">
                <div>
                  <span className="eyebrow">Смотрите также</span>
                  <h2>Другие мероприятия</h2>
                </div>
                <a className="btn btn-ghost" href="/events">
                  Все мероприятия →
                </a>
              </div>
              <div className="grid g3">
                {data.others.map((o) => (
                  <EventCard key={o.slug} e={o} ctx={ctx} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </>
    ),
  };
}
