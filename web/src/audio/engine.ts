// Console audio, all synthesised with the Web Audio API (no files to download or license).
//
// Music: a choice of menu tracks (Settings > Music). Four calm ones in the spirit of a game-console
// home screen (slow pads, soft bells, warm keys) and "Pulse", the upbeat 104 BPM synth-pop loop.
// The chosen track fades out while a game is open (games bring their own music).
//
// Sounds: pitched "move" notes that follow the screen position (sliding along the shelf plays a
// rising melody), clicks, page whooshes, sheet swells, a coin cascade for votes, a launch riser.
//
// Mix: music and sfx -> master -> glue compressor -> limiter -> output. Every voice ramps in from
// silence and the number of sounding voices is capped, so it stays clean when it gets busy.
// Browsers only allow audio after a user gesture, so the context starts on the first one.

import { useSettings, type MusicTrackId } from "../stores/settings";

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
/*
 * Phones crackle when Web Audio has more to do than the phone can keep up with. On a touch screen
 * PlayChain asks for a steadier (slightly later) audio buffer, uses a shorter reverb, plays fewer
 * voices at once, and switches its sound off entirely while a game (with its own sound) is playing.
 */
const TOUCH = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
const VOICE_CAP = TOUCH ? 36 : 64;

let S16 = 60 / 104 / 4;
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
    ctx = new Ctor({ latencyHint: TOUCH ? "playback" : "interactive" });
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
  verb = c.createConvolver(); verb.buffer = TOUCH ? impulse(c, 0.8, 2.6) : impulse(c, 1.6, 2.6);
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
    else if (!(TOUCH && ducked)) void ctx.resume().catch(() => {});
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

// ---- calm instruments ----
/** soft pad with a slow attack, for the calm tracks */
function softPad(notes: number[], t: number, len: number, att: number, peak: number, cut = 1600) {
  const g = gain(L!.pad), lp = filt("lowpass", cut, 0.4, g);
  env(g, t, att, peak, Math.max(0.1, len - att - 0.8), 1.6);
  notes.forEach((n, i) => { osc("sawtooth", mtof(n), t, t + len + 1.8, lp, i % 2 ? 6 : -6); osc("triangle", mtof(n), t, t + len + 1.8, lp, i % 2 ? -3 : 3); });
  if (verb) g.connect(verb);
}
/** glassy bell: sine with a soft FM shimmer */
function bell(m: number, t: number, v: number, len = 2.2) {
  const f = mtof(m), g = gain(L!.arp); hit(g, t, v, len);
  const c = osc("sine", f, t, t + len, g);
  const mod = ctx!.createOscillator(), mg = ctx!.createGain(); mod.frequency.value = f * 3.5;
  mg.gain.setValueAtTime(f * 0.8, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.6);
  mod.connect(mg); mg.connect(c.frequency); mod.start(t); mod.stop(t + len); track(mod);
  osc("sine", f * 2, t, t + len * 0.6, gain(g, 0.25));
  if (delay) g.connect(delay);
  if (verb) g.connect(verb);
}
/** electric piano: sine FM with a bright attack that mellows */
function keys(m: number, t: number, v: number, len: number) {
  const f = mtof(m), g = gain(L!.lead); env(g, t, 0.004, v, len, 0.6);
  const c = osc("sine", f, t, t + len + 0.8, g);
  const mod = ctx!.createOscillator(), mg = ctx!.createGain(); mod.frequency.value = f;
  mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.15);
  mod.connect(mg); mg.connect(c.frequency); mod.start(t); mod.stop(t + len + 0.8); track(mod);
  if (verb) g.connect(verb);
}
/** warm round bass */
function sub(m: number, t: number, len: number, v = 0.5) {
  const g = gain(L!.bass), lp = filt("lowpass", 420, 0.7, g); env(g, t, 0.06, v, len, 0.5);
  osc("sine", mtof(m), t, t + len + 0.7, lp); osc("triangle", mtof(m), t, t + len + 0.7, gain(lp, 0.3));
}
function softKick(t: number, v = 0.45) { const g = gain(L!.drums); hit(g, t, v, 0.3); const o = osc("sine", 110, t, t + 0.32, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); }
function rim(t: number, v = 0.12) { const g = gain(L!.drums), bp = filt("bandpass", 1800, 4, g); hit(g, t, v, 0.06); osc("triangle", 1700, t, t + 0.07, bp); osc("square", 820, t, t + 0.04, bp); }

/* chords: bass root and voicing (MIDI) */
type Bar = { root: number; pad: number[] };
// Aurora: D major, Dmaj9 - Bm9 - Gmaj9 - A6sus. Slow pads and falling bells.
const AURORA: Bar[] = [
  { root: 38, pad: [62, 66, 69, 73, 76] }, { root: 35, pad: [62, 66, 69, 73, 74] },
  { root: 31, pad: [62, 66, 67, 71, 74] }, { root: 33, pad: [61, 64, 66, 69, 74] },
];
// Glass Garden: F major, Fmaj7 - Am7 - Dm9 - Bbmaj9. Broken-chord electric piano.
const GLASS: Bar[] = [
  { root: 41, pad: [60, 64, 65, 69] }, { root: 45, pad: [60, 64, 67, 69] },
  { root: 38, pad: [60, 62, 65, 69] }, { root: 46, pad: [62, 65, 69, 72] },
];
// Nebula: E lydian drift, Emaj9#11 - C#m9 - Amaj9 - Bsus. Very slow swells and sparkles.
const NEBULA: Bar[] = [
  { root: 40, pad: [63, 66, 68, 70, 71] }, { root: 37, pad: [63, 64, 68, 71] },
  { root: 33, pad: [61, 64, 68, 71] }, { root: 35, pad: [61, 64, 66, 71] },
];
// Harbor Lights: A minor 9, Am9 - Fmaj7 - Cmaj7 - G6. Lo-fi keys over a soft beat.
const HARBOR: Bar[] = [
  { root: 33, pad: [60, 64, 67, 71] }, { root: 29, pad: [60, 64, 65, 69] },
  { root: 36, pad: [59, 64, 67, 71] }, { root: 31, pad: [59, 62, 64, 67] },
];
const rnd = (n: number) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };

function auroraStep(s: number, t: number) {
  const i16 = s % 16, bar = Math.floor(s / 16), ch = AURORA[bar % 4], busy = voices > VOICE_CAP;
  if (i16 === 0) { softPad(ch.pad, t, S16 * 16 + 0.6, 1.4, 0.2, 1500); sub(ch.root, t, S16 * 14, 0.42); }
  const pat = bar % 2 ? [0, 6, 10, 13] : [0, 3, 8, 12];
  const k = pat.indexOf(i16);
  if (k >= 0 && !busy) bell(ch.pad[(k + bar) % ch.pad.length] + 12, t, 0.2 - k * 0.025);
  if (bar % 4 === 3 && i16 === 14 && !busy) bell(ch.pad[ch.pad.length - 1] + 24, t, 0.09, 3);
}
function glassStep(s: number, t: number) {
  const i16 = s % 16, bar = Math.floor(s / 16), ch = GLASS[bar % 4], busy = voices > VOICE_CAP;
  if (i16 === 0) { softPad(ch.pad, t, S16 * 16 + 0.4, 0.9, 0.13, 1200); sub(ch.root, t, S16 * 7, 0.45); }
  if (i16 === 8) sub(ch.root + (bar % 2 ? 7 : 0), t, S16 * 7, 0.38);
  if (i16 % 2 === 0 && !busy) {
    const order = [0, 2, 1, 3, 2, 1, 3, 2], n = ch.pad[order[i16 / 2] % ch.pad.length] + 12;
    keys(n, t, i16 === 0 ? 0.32 : 0.22, S16 * 2.2);
  }
  if (bar % 4 === 3 && i16 === 12) bell(ch.pad[3] + 24, t, 0.08, 2.5);
}
function nebulaStep(s: number, t: number) {
  const i16 = s % 16, bar = Math.floor(s / 16), ch = NEBULA[Math.floor(bar / 2) % 4], busy = voices > VOICE_CAP;
  if (i16 === 0 && bar % 2 === 0) { softPad(ch.pad, t, S16 * 32 + 1, 2.6, 0.2, 1100); sub(ch.root, t, S16 * 30, 0.36); }
  if (!busy && rnd(s * 7 + 3) < 0.09) bell(ch.pad[Math.floor(rnd(s) * ch.pad.length)] + 12 + (rnd(s + 1) < 0.4 ? 12 : 0), t, 0.11, 3.2);
}
function harborStep(s: number, t: number) {
  const i16 = s % 16, bar = Math.floor(s / 16), ch = HARBOR[bar % 4], busy = voices > VOICE_CAP;
  if (i16 === 0) softPad(ch.pad, t, S16 * 16 + 0.3, 0.6, 0.09, 1000);
  if (i16 === 0 || i16 === 10) softKick(t, 0.4);
  if (i16 === 4 || i16 === 12) rim(t, 0.11);
  if (i16 % 2 === 0 && !busy) hat(t, i16 % 4 === 2 ? 0.05 : 0.025);
  if (i16 === 0 || i16 === 6 || i16 === 8) sub(ch.root + (i16 === 6 ? 12 : 0), t, S16 * (i16 === 0 ? 5 : 2), 0.45);
  if ((i16 === 0 || i16 === 7) && !busy) ch.pad.forEach((n, k) => keys(n + 12, t + k * 0.012, 0.13, S16 * (i16 === 0 ? 6 : 3)));
  if (bar % 2 === 1 && (i16 === 11 || i16 === 13) && !busy) keys(ch.pad[i16 === 11 ? 3 : 2] + 24, t, 0.09, S16 * 2);
}

export const MUSIC_TRACKS: { id: MusicTrackId; name: string; description: string; bpm: number }[] = [
  { id: "aurora", name: "Aurora", description: "Slow pads and falling bells. Calm and spacious.", bpm: 72 },
  { id: "glass", name: "Glass Garden", description: "Gentle electric piano over warm chords.", bpm: 84 },
  { id: "nebula", name: "Nebula", description: "Floating ambient swells and distant sparkles.", bpm: 60 },
  { id: "harbor", name: "Harbor Lights", description: "Soft lo-fi keys over a relaxed beat.", bpm: 80 },
  { id: "pulse", name: "Pulse", description: "The upbeat synth-pop lobby loop.", bpm: 104 },
];
let curTrack: MusicTrackId | null = null;

// ---- sequencer ----
function playStep(s: number, t: number) {
  if (curTrack === "aurora") return auroraStep(s, t);
  if (curTrack === "glass") return glassStep(s, t);
  if (curTrack === "nebula") return nebulaStep(s, t);
  if (curTrack === "harbor") return harborStep(s, t);
  return pulseStep(s, t);
}
function pulseStep(s: number, t: number) {
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
  const want = useSettings.getState().musicTrack ?? "aurora";
  if (want !== curTrack) {
    // switch tracks: the old notes ring out, the new track starts from its first bar
    curTrack = want;
    const tr = MUSIC_TRACKS.find((m) => m.id === want) ?? MUSIC_TRACKS[0];
    S16 = 60 / tr.bpm / 4; step = 0; nextT = ctx.currentTime + 0.3;
    delay?.delayTime.setTargetAtTime(S16 * 3, ctx.currentTime, 0.05);
    pump?.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
  }
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
  if (c.state === "suspended" && !document.hidden && !(TOUCH && ducked)) void c.resume().catch(() => {});
  startMusic();
}

/** Fade the lobby music out while a game is running (and back in afterwards). */
let sleepTimer = 0;
export function duckMusic(on: boolean) {
  if (ducked === on) return;
  ducked = on;
  applyVolumes(on ? 0.25 : 0.8);
  // On phones, two sound engines at once (PlayChain's and the game's) is what makes the audio
  // crackle, so PlayChain's goes to sleep once the music has faded, and wakes when you leave.
  if (!TOUCH || !ctx) return;
  window.clearTimeout(sleepTimer);
  if (on) sleepTimer = window.setTimeout(() => { if (ducked && ctx) void ctx.suspend().catch(() => {}); }, 900);
  else if (!document.hidden) void ctx.resume().catch(() => {});
}

// ---- sound effects ----
export type Sfx =
  | "move" | "hover" | "select" | "back" | "open" | "close" | "page" | "swap"
  | "success" | "burn" | "launch" | "toast" | "error" | "unlock" | "fanfare";

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
    case "fanfare": { // a new game takes the Spotlight: brass-like rise, then a held chord
      [0, 2, 4].forEach((i, k) => blip(PENT[i] + 12, k * 0.09, 0.22, 0.2, "sawtooth"));
      [4, 7, 9].forEach((i) => blip(PENT[i] + 12, 0.3, 0.16, 0.9, "square"));
      blip(PENT[0], 0.3, 0.3, 0.9, "triangle");
      break;
    }
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
