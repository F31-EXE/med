const configured = import.meta.env.VITE_SITE_URL as string | undefined;

const base = (configured ?? (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:4000` : "")).replace(/\/$/, "");

export function siteUrl(path = "/") {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
