// meta.json: how a game describes itself (spec section 11). Everything here
// comes from outside the console, so every field is checked and capped.

import { consoleConfig, GENRES, type Genre } from "../config/console.config";

export interface GameMeta {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  genre: Genre;
  developer: { name: string; x?: string };
  cover: string;
  playUrl: string;
  controls: string;
  version: string;
}

export interface MetaCheck {
  ok: boolean;
  errors: string[];
  meta?: GameMeta;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const X_RE = /^[A-Za-z0-9_]{1,15}$/;
const VERSION_RE = /^[0-9A-Za-z.+-]{1,20}$/;

function str(v: unknown, max: number, required = true): string | null {
  if (typeof v !== "string") return required ? null : "";
  const t = v.trim();
  if (!t) return required ? null : "";
  return t.length <= max ? t : null;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateMeta(input: unknown): MetaCheck {
  const errors: string[] = [];
  const m = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const name = str(m.name, 60);
  if (!name) errors.push("name is required (60 characters max).");
  const slug = str(m.slug, 63);
  if (!slug || !SLUG_RE.test(slug)) errors.push("slug: 2 to 63 lowercase letters, numbers and dashes.");
  const tagline = str(m.tagline, 120, false);
  if (tagline === null) errors.push("tagline: 120 characters max.");
  const description = str(m.description, 400);
  if (!description) errors.push("description is required (400 characters max).");
  const genre = m.genre as Genre;
  if (!GENRES.includes(genre)) errors.push(`genre must be one of ${GENRES.join(", ")}.`);

  const dev = (m.developer && typeof m.developer === "object" ? m.developer : {}) as Record<string, unknown>;
  const devName = str(dev.name, 60);
  if (!devName) errors.push("developer.name is required.");
  const devX = str(dev.x, 15, false);
  if (devX === null || (devX && !X_RE.test(devX))) errors.push("developer.x must be an X handle without @.");

  const cover = str(m.cover, 512);
  if (!cover || !isHttpsUrl(cover)) errors.push("cover must be an https: URL.");
  const playUrl = str(m.playUrl, 512);
  if (!playUrl || !isHttpsUrl(playUrl)) errors.push("playUrl must be an https: URL.");
  const controls = str(m.controls, 160, false);
  if (controls === null) errors.push("controls: 160 characters max.");
  const version = str(m.version, 20);
  if (!version || !VERSION_RE.test(version)) errors.push("version is required, for example 1.0.0.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    meta: {
      name: name!,
      slug: slug!,
      tagline: tagline ?? "",
      description: description!,
      genre,
      developer: { name: devName!, ...(devX ? { x: devX } : {}) },
      cover: cover!,
      playUrl: playUrl!,
      controls: controls ?? "",
      version: version!,
    },
  };
}

function here(): string {
  return typeof window === "undefined" ? consoleConfig.siteOrigin : window.location.origin;
}

/** Origins the player may load a game from (an allowlist, so a listing cannot send players to an arbitrary site). */
export function playOrigins(): string[] {
  return [...new Set([here(), consoleConfig.siteOrigin, ...consoleConfig.extraPlayOrigins])];
}

export function isAllowedPlayUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return false;
    return playOrigins().includes(u.origin);
  } catch {
    return false;
  }
}

/**
 * Files on the production site are also on this deployment, so serve them from
 * here. Preview deploys and local dev then use their own copy of each game.
 */
export function localize(url: string): string {
  try {
    const u = new URL(url);
    if (u.origin === consoleConfig.siteOrigin && u.pathname.startsWith("/games/")) {
      return `${here()}${u.pathname}${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

const metaCache = new Map<string, Promise<MetaCheck>>();

/** Fetch and validate a meta.json. Results are cached per URL for the session. */
export function fetchMeta(uri: string): Promise<MetaCheck> {
  let p = metaCache.get(uri);
  if (!p) {
    p = (async () => {
      if (!isHttpsUrl(uri) && !uri.startsWith("/")) return { ok: false, errors: ["metadata URI must be https:"] };
      const tryUrls = [...new Set([localize(uri), uri])];
      let lastErr = "could not load metadata";
      for (const url of tryUrls) {
        try {
          const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
          if (!res.ok) {
            lastErr = `metadata returned HTTP ${res.status}`;
            continue;
          }
          const text = await res.text();
          if (text.length > 16_384) return { ok: false, errors: ["metadata is larger than 16 KB"] };
          return validateMeta(JSON.parse(text));
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
      return { ok: false, errors: [lastErr] };
    })();
    metaCache.set(uri, p);
  }
  return p;
}

/** Games that ship with this site. Shown in preview mode before anything is listed onchain. */
export const LOCAL_SLUGS = ["neon-tide", "hollow-kingdom", "signal-lost", "gloam-vesper"] as const;

export function localMetaUrl(slug: string): string {
  return `${consoleConfig.siteOrigin}/games/${slug}/meta.json`;
}
