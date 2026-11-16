// Turns GLOAM: VESPER's single-file build into a PlayChain game page.
//
//   node scripts/wrap-vesper.mjs "<path to GLOAM VESPER.html>"
//
// The single file comes from the game's own repo (`npm run share` in GLOAM VESPER). PlayChain runs
// games in a sandboxed frame with no storage of its own, so this adds a small bridge in front of the
// game: saves go through playchain:save / playchain:load, Esc on the title returns to the console,
// and the console's pause and mute reach the game's sound. The game's code itself is not changed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) throw new Error("Pass the path to GLOAM VESPER.html");
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "games", "gloam-vesper", "index.html");

const BRIDGE = `<script>(() => {
  const inFrame = window.parent !== window;
  const post = (m) => { try { window.parent.postMessage(m, "*"); } catch (e) {} };

  // Storage. A sandboxed frame has none, so the game's save lives in memory and is copied to the
  // console after each change. Outside PlayChain the browser's own storage is used as usual.
  let real = null;
  try { real = window.localStorage; real.getItem("x"); } catch (e) { real = null; }
  const mem = new Map();
  let timer = 0;
  const flush = () => { timer = 0; post({ type: "playchain:save", data: Object.fromEntries(mem) }); };
  const shim = {
    getItem: (k) => (mem.has(String(k)) ? mem.get(String(k)) : null),
    setItem: (k, v) => { mem.set(String(k), String(v)); if (!timer) timer = setTimeout(flush, 400); },
    removeItem: (k) => { mem.delete(String(k)); if (!timer) timer = setTimeout(flush, 400); },
    clear: () => { mem.clear(); if (!timer) timer = setTimeout(flush, 400); },
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  if (inFrame && !real) Object.defineProperty(window, "localStorage", { value: shim, configurable: true });

  // Fullscreen belongs to PlayChain: the game going fullscreen by itself would hide the PlayChain
  // button. Its own request (made on phones when you press Begin) quietly does nothing here.
  if (inFrame) Element.prototype.requestFullscreen = function () { return Promise.resolve(); };

  // Sound: track every AudioContext so the console can pause or mute it.
  const ctxs = [];
  const Real = window.AudioContext || window.webkitAudioContext;
  if (Real) {
    // Phones get a steadier (slightly later) audio buffer, so the sound doesn't crackle.
    const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const Tracked = function (...a) { const c = new Real(...(a.length || !coarse ? a : [{ latencyHint: "playback" }])); ctxs.push(c); return c; };
    Tracked.prototype = Real.prototype;
    window.AudioContext = Tracked;
  }
  let paused = false, muted = false;
  const sound = () => ctxs.forEach((c) => (paused || muted ? c.suspend() : c.resume()).catch(() => {}));

  const atTitle = () => document.body.classList.contains("at-title");
  const popupOpen = () => !!document.querySelector('[role="dialog"], .card.pause');
  const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: "Escape", key: "Escape", bubbles: true }));

  // Esc on the title screen, with nothing open, goes back to PlayChain.
  window.addEventListener("keydown", (e) => {
    if (inFrame && e.code === "Escape" && e.isTrusted && atTitle() && !popupOpen()) post({ type: "playchain:exit" });
  }, true);

  let booted = false;
  const boot = () => {
    if (booted) return;
    // The save can arrive while the page is still loading. A module script never runs before the
    // page has been read, so neither does the game.
    if (document.readyState === "loading") return void document.addEventListener("DOMContentLoaded", boot, { once: true });
    booted = true;
    const held = document.getElementById("vesper-main");
    const s = document.createElement("script");
    s.type = "module";
    s.textContent = held.textContent;
    held.remove();
    document.body.appendChild(s);
    post({ type: "playchain:ready" });
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    const m = e.data || {};
    if (m.type === "playchain:loaded") {
      if (!booted && m.data && typeof m.data === "object") for (const [k, v] of Object.entries(m.data)) if (typeof v === "string") mem.set(k, v);
      boot();
    } else if (m.type === "playchain:pause") {
      paused = true; sound();
      // Open the game's own pause menu so nothing moves while the console menu is up.
      if (booted && !atTitle() && !popupOpen()) { key("keydown"); setTimeout(() => key("keyup"), 60); }
    } else if (m.type === "playchain:resume") {
      paused = false; sound();
    } else if (m.type === "playchain:mute") {
      muted = !!m.muted; sound();
    }
  });

  if (inFrame && !real) { post({ type: "playchain:load" }); setTimeout(boot, 1500); }
  else document.addEventListener("DOMContentLoaded", boot);
})();</script>`;

let html = readFileSync(src, "utf8");
const MODULE = '<script type="module">';
const at = html.indexOf(MODULE);
if (at < 0 || html.indexOf(MODULE, at + 1) >= 0) throw new Error("Expected exactly one module script in the game file");
// Hold the game's code until the save has arrived, then the bridge starts it.
html = html.slice(0, at) + '<script type="text/plain" id="vesper-main">' + html.slice(at + MODULE.length);
const head = html.indexOf("<head>");
if (head < 0) throw new Error("No <head> in the game file");
html = html.slice(0, head + 6) + "\n" + BRIDGE + html.slice(head + 6);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`);
