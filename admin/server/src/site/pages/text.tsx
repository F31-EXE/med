import type { SiteCtx } from "../context.js";
import { titleOf, type View } from "../render.js";
import { Crumbs, Paras } from "../ui.js";
import { consentText } from "../consentText.js";

const fallback: Record<string, string> = {
  privacy: "Текст политики конфиденциальности будет опубликован в ближайшее время.",
  consent: consentText,
  thanks: "Мы получили вашу заявку и свяжемся с вами в ближайшее время. Если вы регистрировались на мероприятие — проверьте почту: туда пришло письмо с подтверждением.",
};

export async function textView(ctx: SiteCtx, key: "privacy" | "consent" | "thanks"): Promise<View> {
  const p = ctx.page(key);
  const isThanks = key === "thanks";
  return {
    meta: { title: p.seoTitle ?? titleOf(ctx, p.title), description: p.seoDescription, noindex: isThanks },
    body: (
      <div className="wrap">
        <Crumbs items={[{ label: p.title }]} />
        {isThanks ? (
          <div className="nf">
            <div className="form-done">
              <div className="ok" aria-hidden="true">
                ✓
              </div>
            </div>
            <h1>{p.title}</h1>
            <Paras text={p.body ?? fallback.thanks} className="prose" />
            <div className="hero-actions" style={{ marginTop: 26 }}>
              <a className="btn" href="/events">
                Мероприятия
              </a>
              <a className="btn btn-ghost" href="/">
                На главную
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="page-head">
              <h1>{p.title}</h1>
            </div>
            <Paras text={p.body ?? fallback[key]} className="prose" />
          </>
        )}
      </div>
    ),
  };
}

export async function notFoundView(ctx: SiteCtx): Promise<View> {
  const p = ctx.page("not-found");
  return {
    status: 404,
    meta: { title: titleOf(ctx, "Страница не найдена"), noindex: true },
    body: (
      <div className="wrap">
        <div className="nf">
          <div className="big">404</div>
          <h1 style={{ fontSize: "2rem" }}>{p.title === "Страница не найдена (404)" ? "Страница не найдена" : p.title}</h1>
          <p>{p.body ?? "Возможно, адрес изменился или страница была удалена. Попробуйте поиск или перейдите в каталог мероприятий."}</p>
          <div className="hero-actions">
            <a className="btn" href="/events">
              Мероприятия
            </a>
            <a className="btn btn-ghost" href={ctx.href("search")}>
              Поиск по сайту
            </a>
          </div>
        </div>
      </div>
    ),
  };
}

export function errorView(ctx: SiteCtx): View {
  return {
    status: 500,
    meta: { title: titleOf(ctx, "Ошибка на сервере"), noindex: true },
    body: (
      <div className="wrap">
        <div className="nf">
          <div className="big">500</div>
          <h1 style={{ fontSize: "2rem" }}>Что-то пошло не так</h1>
          <p>Мы уже знаем об ошибке. Попробуйте обновить страницу через минуту.</p>
          <div className="hero-actions">
            <a className="btn" href="/">
              На главную
            </a>
          </div>
        </div>
      </div>
    ),
  };
}
