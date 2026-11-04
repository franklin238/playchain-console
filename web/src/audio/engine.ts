// Console audio: a generated ambient pad and short UI sounds, all synthesised
// with the Web Audio API (no audio files to download or license).
//
// Browsers only allow audio after a user gesture, so the context is created
// lazily on the first key press, click or tap.

import { useSettings } from "../stores/settings";

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicStarted = false;
let ducked = false;
let chordTimer = 0;

const CHORDS: number[][] = [
  // Am9, Fmaj7, Cmaj7/E, G6 (MIDI note numbers)
  [45, 57, 60, 64, 71],
  [41, 57, 60, 64, 69],
  [40, 55, 59, 64, 67],
  [43, 55, 59, 62, 64],
];
const CHORD_SECONDS = 9;

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function volumes() {
  const s = useSettings.getState();
  const music = s.muted || ducked ? 0 : (s.musicVolume / 100) * 0.22;
  const sfx = s.muted ? 0 : (s.sfxVolume / 100) * 0.35;
  return { music, sfx };
}

function applyVolumes(ramp = 0.6) {
  if (!ctx || !musicGain || !sfxGain) return;
  const { music, sfx } = volumes();
  const t = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setTargetAtTime(music, t, ramp / 3);
  sfxGain.gain.setValueAtTime(sfx, t);
}

function makeReverb(context: AudioContext): ConvolverNode {
  const seconds = 4;
  const length = context.sampleRate * seconds;
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  const conv = context.createConvolver();
  conv.buffer = impulse;
  return conv;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  } catch {
    return null;
  }
  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  sfxGain = ctx.createGain();
  musicGain.connect(ctx.destination);
  sfxGain.connect(ctx.destination);

  // Music bus: lowpass with a slow sweep, then a long reverb.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.05;
  lfoDepth.gain.value = 350;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();

  const reverb = makeReverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  const dry = ctx.createGain();
  dry.gain.value = 0.45;
  musicBus = ctx.createGain();
  musicBus.connect(filter);
  filter.connect(dry).connect(musicGain);
  filter.connect(reverb).connect(wet).connect(musicGain);

  useSettings.subscribe(() => applyVolumes(0.3));
  return ctx;
}

function playChord(index: number) {
  if (!ctx || !musicBus) return;
  const now = ctx.currentTime;
  const chord = CHORDS[index % CHORDS.length];
  for (const [i, note] of chord.entries()) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = midiToHz(note);
      osc.detune.value = detune;
      const env = ctx.createGain();
      const peak = i === 0 ? 0.16 : 0.07;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(peak, now + 3);
      env.gain.setValueAtTime(peak, now + CHORD_SECONDS - 1);
      env.gain.linearRampToValueAtTime(0, now + CHORD_SECONDS + 3);
      osc.connect(env).connect(musicBus);
      osc.start(now);
      osc.stop(now + CHORD_SECONDS + 3.1);
    }
  }
}

function startMusic() {
  if (musicStarted || !ctx) return;
  musicStarted = true;
  let i = 0;
  playChord(i++);
  chordTimer = window.setInterval(() => {
    // Skip scheduling while the tab is hidden or music is silent.
    if (document.hidden || volumes().music === 0) return;
    playChord(i++);
  }, CHORD_SECONDS * 1000);
  applyVolumes(4);
}

/** Call on any user gesture. Creates/resumes audio and starts the music. */
export function unlockAudio() {
  const context = ensureContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume().catch(() => {});
  startMusic();
}

/** Fade the music out while a game is running (and back in afterwards). */
export function duckMusic(on: boolean) {
  ducked = on;
  applyVolumes(1.2);
}

export type Sfx = "move" | "select" | "back" | "open" | "error" | "unlock";

export function playSfx(kind: Sfx) {
  if (!ctx || !sfxGain || ctx.state !== "running") return;
  if (volumes().sfx === 0) return;
  const now = ctx.currentTime;
  const tone = (freq: number, start: number, dur: number, type: OscillatorType = "sine", peak = 0.5) => {
    const osc = ctx!.createOscillator();
    const env = ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    env.gain.setValueAtTime(0, now + start);
    env.gain.linearRampToValueAtTime(peak, now + start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(env).connect(sfxGain!);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };
  switch (kind) {
    case "move":
      tone(1320, 0, 0.05, "sine", 0.18);
      break;
    case "select":
      tone(880, 0, 0.08, "triangle", 0.4);
      tone(1320, 0.05, 0.12, "triangle", 0.3);
      break;
    case "back":
      tone(660, 0, 0.07, "triangle", 0.35);
      tone(440, 0.05, 0.1, "triangle", 0.25);
      break;
    case "open":
      tone(523, 0, 0.12, "sine", 0.35);
      tone(784, 0.06, 0.18, "sine", 0.3);
      break;
    case "error":
      tone(196, 0, 0.18, "square", 0.12);
      break;
    case "unlock":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.35, "triangle", 0.3));
      break;
  }
}

export function stopAudioForTests() {
  window.clearInterval(chordTimer);
}
