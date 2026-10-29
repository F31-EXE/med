import sanitizeHtml from "sanitize-html";
import { z } from "zod";

const options: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    h1: "h2",
    h4: "h3",
    h5: "h3",
    h6: "h3",
    b: "strong",
    i: "em",
    del: "s",
    strike: "s",
    a: (tagName, source) => {
      const href = source.href?.trim() ?? "";
      const safe = /^(https?:|mailto:|tel:|\/(?!\/))/i.test(href);
      const attribs: sanitizeHtml.Attributes = safe ? { href, target: "_blank", rel: "noopener noreferrer" } : {};
      return { tagName, attribs };
    },
  },
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeRichText(value: string) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  const html = looksLikeHtml
    ? value
    : value
        .split(/\n\s*\n/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
  return sanitizeHtml(html, options)
    .replace(/<a>([\s\S]*?)<\/a>/g, "$1")
    .trim();
}

export function plainTextLength(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, " ").length;
}

export const richText = (maxChars: number) =>
  z
    .string()
    .max(maxChars * 4, "Текст слишком длинный")
    .nullish()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const clean = sanitizeRichText(v);
      const length = plainTextLength(clean);
      if (length > maxChars) ctx.addIssue({ code: "custom", message: `Не длиннее ${maxChars} знаков` });
      return length === 0 ? null : clean;
    });
