// Content Security Policy for console pages (spec section 7.1).
//
// Used by the Vite dev and preview servers. `vercel.json` carries the same
// production policy, and a unit test checks that the two stay identical.

export interface CspOptions {
  /** Dev server only: Vite's hot reload needs one inline script. */
  dev: boolean;
  /** Extra origins allowed in frames (the local games server in dev and preview). */
  extraFrameOrigins?: string[];
  /** Local test RPC (end-to-end tests against an anvil fork only). */
  extraConnect?: string[];
}

export function buildConsoleCsp({ dev, extraFrameOrigins = [], extraConnect = [] }: CspOptions): string {
  const frameSrc = ["'self'", "https:", ...extraFrameOrigins].join(" ");
  const directives: Record<string, string> = {
    "default-src": "'self'",
    // No inline script on console pages. Dev adds it only for the hot-reload preamble.
    "script-src": dev ? "'self' 'unsafe-inline'" : "'self'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob: https:",
    "media-src": "'self' data: blob: https:",
    "font-src": "'self' data:",
    "connect-src": [dev ? "'self' https: wss: ws:" : "'self' https: wss:", ...extraConnect].join(" "),
    // Games may only be framed from HTTPS (or the local games server).
    "frame-src": frameSrc,
    "child-src": frameSrc,
    "worker-src": "'self' blob:",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    // Nobody may frame the console itself (stops clickjacking of the vote sheet).
    "frame-ancestors": "'none'",
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ");
}

/** Headers sent with every console page. */
export function consoleSecurityHeaders(opts: CspOptions): Record<string, string> {
  return {
    "Content-Security-Policy": buildConsoleCsp(opts),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Denied for the console and every frame inside it, whatever a frame's
    // `allow` attribute says. Gamepad, fullscreen and autoplay are left at their
    // defaults so the player iframe's `allow` attribute can delegate them.
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), clipboard-read=(), display-capture=()",
    // Wallet SDKs such as Coinbase Wallet talk to their own popup windows.
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  };
}

/**
 * Headers for files under /games/. Games are first-party HTML with inline
 * scripts. The console frames them with sandbox="allow-scripts allow-pointer-lock",
 * so they run in an opaque origin and can't reach the console or the wallet.
 * Only the console's own origin may frame them.
 */
export const GAME_POLICY =
  "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'";

export const GAME_HEADERS: Record<string, string> = {
  "Content-Security-Policy": GAME_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Access-Control-Allow-Origin": "*",
};
