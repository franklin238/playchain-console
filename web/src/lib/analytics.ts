// Vercel Web Analytics: counts visits and pages, with no cookies and nothing personal.
// The script is served by Vercel itself at /_vercel/insights/script.js once Analytics is
// turned on for the project (Vercel dashboard -> the project -> Analytics -> Enable).
// It only loads on the deployed site, never in local development.

declare global {
  interface Window {
    va?: (...args: unknown[]) => void;
    vaq?: unknown[][];
  }
}

let started = false;

export function startAnalytics(): void {
  if (started || !import.meta.env.PROD || typeof document === "undefined") return;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  started = true;
  window.va = window.va || ((...args: unknown[]) => (window.vaq = window.vaq || []).push(args));
  const s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
}
