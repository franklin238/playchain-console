// Content Security Policy for console pages (spec section 7.1).
//
// Used by the Vite dev and preview servers. `vercel.json` carries the same
// production policy, and a unit test checks that the two stay identical.

export interface CspOptions {
  /** Dev server only: Vite's hot reload needs one inline script. */
  dev: boolean;
  /** Extra origins allowed in frames (the local games server in dev and preview). */
  extraFrameOrigins?: string[];
}

export function buildConsoleCsp({ dev, extraFrameOrigins = [] }: CspOptions): string {
  const frameSrc = ["https:", ...extraFrameOrigins].join(" ");
  const directives: Record<string, string> = {
    "default-src": "'self'",
    // No inline script on console pages. Dev adds it only for the hot-reload preamble.
    "script-src": dev ? "'self' 'unsafe-inline'" : "'self'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob: https:",
    "media-src": "'self' data: blob: https:",
    "font-src": "'self' data:",
    "connect-src": dev ? "'self' https: wss: ws:" : "'self' https: wss:",
    // Games may only be framed from HTTPS (or the local games server).
    "frame-src": frameSrc,
    "child-src": frameSrc,
    "worker-src": "'self' blob:",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    // Nobody may frame the console itself (stops clickjacking of the signing screen).
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
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), clipboard-read=(), display-capture=()",
    // Wallet SDKs such as Coinbase Wallet talk to their own popup windows.
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  };
}
