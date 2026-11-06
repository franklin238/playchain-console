// Console audio, all synthesised with the Web Audio API (no files to download or license).
//
// Music: "Lobby", an upbeat 104 BPM synth-pop loop in B minor (Bm, G, D, A) from a 16th-note
// step sequencer: intro, then kick, claps, hats, driving bass, a pumping pad and an arp, with a
// lead hook every other 8 bars. It fades out while a game is open (games bring their own music).
//
// Sounds: pitched "move" notes that follow the screen position (sliding along the shelf plays a
// rising melody), clicks, page whooshes, sheet swells, a coin cascade for votes, a launch riser.
//
// Mix: music and sfx -> master -> glue compressor -> limiter -> output. Every voice ramps in from
// silence and the number of sounding voices is capped, so it stays clean when it gets busy.
// Browsers only allow audio after a user gesture, so the context starts on the first one.

import { useSettings } from "../stores/settings";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let L: Record<"drums" | "bass" | "pad" | "arp" | "lead", GainNode> | null = null;
let pump: GainNode | null = null;
let delay: DelayNode | null = null;
let verb: ConvolverNode | null = null;
let timer = 0;
let ducked = false;
let step = 0;
let nextT = 0;
let voices = 0;
const VOICE_CAP = 64;

const BPM = 104;
const S16 = 60 / BPM / 4;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// One chord per bar: bass root and pad voicing. B minor: Bm, G, D, A.
const PROG = [
  { root: 35, pad: [62, 66, 69, 74] },
  { root: 31, pad: [62, 67, 71, 74] },
  { root: 38, pad: [62, 66, 69, 73] },
  { root: 33, pad: [61, 64, 69, 73] },
];
const KICK = "x...x...x...x...";
const CLAP = "....x.......x...";
const HAT = "..x...x...x...xx";
const BASS = "x.xx.xx.x.xx.x.x"; // driving, syncopated
const ARP = [0, 1, 2, 3, 2, 1, 3, 2, 0, 1, 2, 3, 4, 3, 2, 1];
// Lead hook over 4 bars on the 8th grid: MIDI, -1 rest, 0 hold.
const HOOK = [
  78, 0, 81, 0, 83, 0, 81, 78,   76, 0, 0, 74, 76, 0, -1, 0,
  74, 0, 76, 0, 78, 0, 81, 0,    76, 0, 0, 0, 73, 0, -1, 0,
];
// Pentatonic scale for moving sounds (B minor pentatonic).
const PENT = [71, 74, 76, 78, 81, 83, 86, 88, 90, 93, 95];

function volumes() {
  const s = useSettings.getState();
  return {
    music: s.muted || ducked ? 0 : (s.musicVolume / 100) * 0.55,
    sfx: s.muted ? 0 : (s.sfxVolume / 100) * 0.7,
  };
}

function applyVolumes(tau = 0.25) {
  if (!ctx || !musicGain || !sfxGain) return;
  const { music, sfx } = volumes(), t = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setTargetAtTime(music, t, tau);
  sfxGain.gain.setTargetAtTime(sfx, t, 0.02);
}

function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const n = Math.floor(c.sampleRate * seconds), b = c.createBuffer(2, n, c.sampleRate);
  let r = 0x2345;
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; d[i] = (((r >>> 0) / 4294967296) * 2 - 1) * Math.pow(1 - i / n, decay); }
  }
  return b;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  const c = ctx;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  master = c.createGain(); master.gain.value = 0.9;
  master.connect(comp); comp.connect(lim); lim.connect(c.destination);
  musicGain = c.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
  sfxGain = c.createGain(); sfxGain.connect(master);

  // music layers, a short reverb and a dotted-8th delay
  verb = c.createConvolver(); verb.buffer = impulse(c, 1.6, 2.6);
  const verbOut = c.createGain(); verbOut.gain.value = 0.28; verb.connect(verbOut); verbOut.connect(musicGain);
  delay = c.createDelay(1); delay.delayTime.value = S16 * 3;
  const fb = c.createGain(); fb.gain.value = 0.32;
  const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3000;
  const dOut = c.createGain(); dOut.gain.value = 0.3;
  delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(dOut); dOut.connect(musicGain);
  const mk = (v: number) => { const g = c.createGain(); g.gain.value = v; g.connect(musicGain!); return g; };
  L = { drums: mk(0.85), bass: mk(0.55), pad: mk(0.32), arp: mk(0.22), lead: mk(0.3) };
  pump = c.createGain(); pump.connect(L.pad);

  useSettings.subscribe(() => applyVolumes(0.15));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else void ctx.resume().catch(() => {});
  });
  return c;
}

// ---- voices ----
function track(n: AudioScheduledSourceNode) {
  voices++;
  n.onended = () => { voices--; try { n.disconnect(); } catch { /* already gone */ } };
}
function osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0): OscillatorNode {
  const o = ctx!.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(end + 0.05); track(o);
  return o;
}
function gain(dest: AudioNode, v = 0): GainNode { const g = ctx!.createGain(); g.gain.value = v; g.connect(dest); return g; }
function filt(type: BiquadFilterType, f: number, q: number, dest: AudioNode): BiquadFilterNode {
  const b = ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b;
}
/** percussive: ramp in over 3 ms, decay to silence */
function hit(g: GainNode, t: number, peak: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
}
/** sustained: attack, hold, release */
function env(g: GainNode, t: number, a: number, peak: number, hold: number, r: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0008, t + a + hold + r);
}

// ---- instruments ----
function kick(t: number) {
  const g = gain(L!.drums); hit(g, t, 0.95, 0.32);
  const o = osc("sine", 140, t, t + 0.34, g); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  pump!.gain.setTargetAtTime(0.4, t, 0.006); pump!.gain.setTargetAtTime(1, t + 0.04, 0.07);
}
function clap(t: number) {
  // three tight square bursts through a bandpass: a synthetic clap without white noise
  const g = gain(L!.drums), bp = filt("bandpass", 1600, 1.2, g);
  g.gain.setValueAtTime(0.0001, t);
  [0, 0.012, 0.024].forEach((d) => { g.gain.linearRampToValueAtTime(0.42, t + d + 0.002); g.gain.linearRampToValueAtTime(0.12, t + d + 0.01); });
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.18);
  osc("square", 380, t, t + 0.2, bp); osc("square", 517, t, t + 0.2, bp);
  if (verb) { const s = gain(verb, 0.4); g.connect(s); }
}
function hat(t: number, v: number) {
  const g = gain(L!.drums), hp = filt("highpass", 7000, 0.8, g); hit(g, t, v, 0.05);
  [1, 1.47, 1.83, 2.41].forEach((r) => osc("square", 3200 * r, t, t + 0.06, hp));
}
function bass(m: number, t: number, len: number) {
  const g = gain(L!.bass), lp = filt("lowpass", 900, 4, g);
  lp.frequency.setValueAtTime(1400, t); lp.frequency.setTargetAtTime(320, t, 0.06);
  env(g, t, 0.004, 0.6, len * 0.6, 0.06);
  osc("sawtooth", mtof(m), t, t + len + 0.1, lp); osc("square", mtof(m - 12), t, t + len + 0.1, lp);
}
function pad(notes: number[], t: number, len: number) {
  const g = gain(pump!), lp = filt("lowpass", 1400, 0.5, g);
  env(g, t, 0.25, 0.22, len - 0.4, 0.5);
  notes.forEach((n, i) => osc("sawtooth", mtof(n), t, t + len + 0.6, lp, i % 2 ? 7 : -7));
  if (verb) g.connect(verb);
}
function arp(m: number, t: number) {
  const g = gain(L!.arp), lp = filt("lowpass", 3800, 1, g);
  lp.frequency.setValueAtTime(4200, t); lp.frequency.setTargetAtTime(1200, t, 0.05);
  hit(g, t, 0.5, 0.2);
  osc("square", mtof(m), t, t + 0.22, lp);
  if (delay) g.connect(delay);
}
function lead(m: number, t: number, len: number) {
  const g = gain(L!.lead), lp = filt("lowpass", 3200, 1.5, g);
  env(g, t, 0.015, 0.45, Math.max(0.02, len - 0.08), 0.12);
  const a = osc("sawtooth", mtof(m), t, t + len + 0.25, lp, -5), b = osc("square", mtof(m), t, t + len + 0.25, lp, 5);
  const vib = ctx!.createOscillator(), vg = ctx!.createGain(); vib.frequency.value = 5.5; vg.gain.value = 7;
  vib.connect(vg); vg.connect(a.detune); vg.connect(b.detune); vib.start(t + 0.12); vib.stop(t + len + 0.25); track(vib);
  if (delay) g.connect(delay);
  if (verb) g.connect(verb);
}

// ---- sequencer ----
function playStep(s: number, t: number) {
  const i16 = s % 16, bar = Math.floor(s / 16), cyc = bar % 16, ch = PROG[bar % PROG.length];
  const intro = bar < 4, busy = voices > VOICE_CAP;
  if (i16 === 0) pad(ch.pad, t, S16 * 16 + 0.2);
  if (!intro) {
    if (KICK[i16] === "x") kick(t);
    if (CLAP[i16] === "x") clap(t);
    if (HAT[i16] === "x" && !busy) hat(t, i16 % 4 === 2 ? 0.16 : 0.09);
    if (BASS[i16] === "x") bass(ch.root + (i16 === 6 || i16 === 14 ? 12 : 0), t, S16 * 1.6);
  }
  if (!busy) { const ai = ARP[i16], p = ch.pad; arp((ai < p.length ? p[ai] : p[ai - p.length] + 12) + 12, t); }
  // lead hook in the second half of every 16-bar cycle
  if (cyc >= 8 && i16 % 2 === 0) {
    const li = (cyc % 4) * 8 + i16 / 2, n = HOOK[li];
    if (n > 0) { let len = 1; while (li + len < HOOK.length && HOOK[li + len] === 0) len++; lead(n, t, S16 * 2 * len); }
  }
  if (!intro && i16 === 15 && bar % 4 === 3) { clap(t); clap(t + S16 / 2); } // fill into the next phrase
}

function tick() {
  if (!ctx || ctx.state !== "running") return;
  if (volumes().music === 0) { nextT = ctx.currentTime + 0.05; return; } // silent: don't schedule
  while (nextT < ctx.currentTime + 0.12) { playStep(step, nextT); nextT += S16; step++; }
}

function startMusic() {
  if (timer || !ctx) return;
  nextT = ctx.currentTime + 0.1; step = 0;
  timer = window.setInterval(tick, 25);
  applyVolumes(1.2);
}

/** Call on any user gesture. Creates/resumes audio and starts the music. */
export function unlockAudio() {
  const c = ensureContext();
  if (!c) return;
  if (c.state === "suspended" && !document.hidden) void c.resume().catch(() => {});
  startMusic();
}

/** Fade the lobby music out while a game is running (and back in afterwards). */
export function duckMusic(on: boolean) {
  if (ducked === on) return;
  ducked = on;
  applyVolumes(on ? 0.25 : 0.8);
}

// ---- sound effects ----
export type Sfx =
  | "move" | "hover" | "select" | "back" | "open" | "close" | "page" | "swap"
  | "success" | "burn" | "launch" | "toast" | "error" | "unlock";

const lastAt: Partial<Record<Sfx, number>> = {};
const GAP: Partial<Record<Sfx, number>> = { hover: 0.035, move: 0.03, select: 0.04, page: 0.12, swap: 0.08, toast: 0.1 };

/** `pitch` (0..1) picks the note for move and hover: use the element's position on screen. */
export function playSfx(kind: Sfx, pitch = 0.5) {
  if (!ctx || !sfxGain || ctx.state !== "running" || volumes().sfx === 0) return;
  const now = ctx.currentTime;
  if (lastAt[kind] != null && now - lastAt[kind]! < (GAP[kind] ?? 0.02)) return;
  if (voices > VOICE_CAP + 24 && (kind === "hover" || kind === "move")) return;
  lastAt[kind] = now;
  const t = now + 0.005, S = sfxGain;
  const note = PENT[Math.max(0, Math.min(PENT.length - 1, Math.round(pitch * (PENT.length - 1))))];
  const blip = (m: number, at: number, peak: number, dur: number, type: OscillatorType = "triangle") => {
    const g = gain(S); hit(g, t + at, peak, dur); osc(type, mtof(m), t + at, t + at + dur, g);
  };
  const sweep = (from: number, to: number, dur: number, peak: number, q = 2) => {
    const g = gain(S), lp = filt("bandpass", from, q, g);
    lp.frequency.setValueAtTime(from, t); lp.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, dur * 0.35, peak, dur * 0.2, dur * 0.45);
    osc("sawtooth", 110, t, t + dur + 0.1, lp, -12); osc("sawtooth", 110, t, t + dur + 0.1, lp, 12);
  };
  switch (kind) {
    case "hover": blip(note, 0, 0.16, 0.09); break;
    case "move": { const g = gain(S); hit(g, t, 0.22, 0.12); const o = osc("triangle", mtof(note) * 0.97, t, t + 0.12, g); o.frequency.exponentialRampToValueAtTime(mtof(note), t + 0.02); break; }
    case "select": { // click + bright two-note blip
      const c = gain(S); hit(c, t, 0.35, 0.012); osc("square", 2600, t, t + 0.015, c);
      blip(83, 0.006, 0.32, 0.1, "square"); blip(90, 0.05, 0.26, 0.14);
      break;
    }
    case "back": blip(83, 0, 0.28, 0.09, "square"); blip(76, 0.05, 0.22, 0.12); break;
    case "open": sweep(300, 3200, 0.38, 0.24); blip(86, 0.18, 0.18, 0.3); blip(93, 0.24, 0.14, 0.35); break;
    case "close": sweep(2600, 260, 0.3, 0.2); break;
    case "page": sweep(500, 2400, 0.26, 0.16, 1.4); break;
    case "swap": [0, 1, 2].forEach((i) => blip(PENT[6 + i], i * 0.035, 0.12, 0.18, "sine")); break;
    case "toast": blip(86, 0, 0.22, 0.25, "sine"); blip(93, 0.08, 0.2, 0.35, "sine"); break;
    case "error": { const g = gain(S), lp = filt("lowpass", 700, 1, g); env(g, t, 0.005, 0.3, 0.12, 0.06); osc("square", 98, t, t + 0.3, lp); osc("square", 104, t + 0.16, t + 0.32, lp); break; }
    case "success": // coin cascade up the scale, then a sparkle
      [0, 2, 4, 5, 7].forEach((i, k) => blip(PENT[i] + 12, k * 0.06, 0.24, 0.25, "square"));
      [0, 1].forEach((k) => blip(PENT[9] + 12, 0.32 + k * 0.09, 0.12, 0.4, "sine"));
      break;
    case "burn": { // low fwoom
      const g = gain(S); env(g, t, 0.04, 0.5, 0.1, 0.5);
      const o = osc("sine", 120, t, t + 0.75, g); o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
      const g2 = gain(S), lp = filt("lowpass", 300, 3, g2); env(g2, t, 0.1, 0.18, 0.1, 0.4); lp.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
      osc("sawtooth", 55, t, t + 0.7, lp);
      break;
    }
    case "launch": { // riser into an impact
      const g = gain(S), lp = filt("lowpass", 400, 6, g);
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(6000, t + 0.55);
      env(g, t, 0.5, 0.3, 0.02, 0.12);
      const o = osc("sawtooth", 110, t, t + 0.7, lp); o.frequency.exponentialRampToValueAtTime(440, t + 0.55);
      const k = gain(S); hit(k, t + 0.56, 0.8, 0.35); const ko = osc("sine", 150, t + 0.56, t + 0.9, k); ko.frequency.exponentialRampToValueAtTime(45, t + 0.7);
      blip(PENT[7], 0.56, 0.25, 0.5, "square");
      break;
    }
    case "unlock": [0, 2, 4, 7].forEach((i, k) => blip(PENT[i] + 12, k * 0.07, 0.24, 0.45, "triangle")); break;
  }
}

/**
 * Sounds for the mouse: a pitched note on hovering anything interactive (the pitch follows the
 * element's position, so sliding along the shelf plays a melody) and a click on clicking it.
 */
export function installUiSounds(): () => void {
  let last: Element | null = null;
  const pick = (e: Event) => (e.target as Element | null)?.closest?.("button, a[href], [role='button'], select, input[type='range'], [data-sfx]") ?? null;
  const pitchOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (r.left + r.width / 2) / Math.max(1, window.innerWidth)));
  };
  const over = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const el = pick(e);
    if (el === last) return;
    last = el;
    if (el && !(el as HTMLButtonElement).disabled) playSfx("hover", pitchOf(el));
  };
  const click = (e: MouseEvent) => {
    const el = pick(e);
    if (!el || (el as HTMLButtonElement).disabled) return;
    const kind = (el as HTMLElement).dataset.sfx as Sfx | undefined;
    playSfx(kind ?? "select");
  };
  document.addEventListener("pointerover", over, { passive: true });
  document.addEventListener("click", click, { capture: true });
  return () => {
    document.removeEventListener("pointerover", over);
    document.removeEventListener("click", click, { capture: true });
  };
}

export function stopAudioForTests() {
  window.clearInterval(timer);
  timer = 0;
}
