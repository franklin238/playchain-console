// Console colour themes. Each one overrides the Tailwind colour variables from index.css at runtime,
// so every screen, button and tile follows the chosen theme without any per-component code.

export type ThemeId = "lime" | "ocean" | "ember" | "royal" | "rose" | "gold" | "frost";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  vars: Record<string, string>;
}

const base = (bg: string, bg2: string, surface: string, surface2: string, line: string, lineStrong: string) => ({
  "--color-bg": bg,
  "--color-bg-2": bg2,
  "--color-surface": surface,
  "--color-surface-2": surface2,
  "--color-line": line,
  "--color-line-strong": lineStrong,
});

export const THEMES: Theme[] = [
  {
    id: "lime",
    name: "Neon Lime",
    description: "The original: charcoal with an electric lime accent.",
    vars: { ...base("#0b0d0c", "#111513", "#151a17", "#1e2521", "#253029", "#3d4c43"), "--color-accent": "#c8ff4d", "--color-accent-hover": "#d8ff7a", "--color-accent-text": "#c8ff4d", "--color-on-accent": "#0b0d0c", "--focus-glow": "rgb(200 255 77 / 0.25)" },
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    description: "Midnight blue with a bright sky accent.",
    vars: { ...base("#070b12", "#0b1119", "#101823", "#17212e", "#1f2c3b", "#344a60"), "--color-accent": "#4dc3ff", "--color-accent-hover": "#7ad3ff", "--color-accent-text": "#6fcfff", "--color-on-accent": "#04101a", "--focus-glow": "rgb(77 195 255 / 0.28)" },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm ash grey with a glowing orange accent.",
    vars: { ...base("#0e0a09", "#15100e", "#1a1412", "#241c19", "#30251f", "#4d3b32"), "--color-accent": "#ff8a3d", "--color-accent-hover": "#ffa366", "--color-accent-text": "#ff9a55", "--color-on-accent": "#150a04", "--focus-glow": "rgb(255 138 61 / 0.28)" },
  },
  {
    id: "royal",
    name: "Royal Violet",
    description: "Deep purple night with a lavender accent.",
    vars: { ...base("#0b0912", "#110e1a", "#161222", "#1e1930", "#2a2340", "#433862"), "--color-accent": "#b48cff", "--color-accent-hover": "#c7a8ff", "--color-accent-text": "#c0a0ff", "--color-on-accent": "#0e0819", "--focus-glow": "rgb(180 140 255 / 0.28)" },
  },
  {
    id: "rose",
    name: "Rose Quartz",
    description: "Soft plum dark with a pink accent.",
    vars: { ...base("#100a0d", "#170f13", "#1d1318", "#271a21", "#35232c", "#553a47"), "--color-accent": "#ff6fa5", "--color-accent-hover": "#ff93bc", "--color-accent-text": "#ff86b3", "--color-on-accent": "#19060e", "--focus-glow": "rgb(255 111 165 / 0.28)" },
  },
  {
    id: "gold",
    name: "Royal Gold",
    description: "Black and gold, like a trophy case.",
    vars: { ...base("#0c0b08", "#13110c", "#181610", "#221f17", "#2f2a1f", "#4c4430"), "--color-accent": "#f2c14e", "--color-accent-hover": "#f6d27e", "--color-accent-text": "#f4ca63", "--color-on-accent": "#140f02", "--focus-glow": "rgb(242 193 78 / 0.28)" },
  },
  {
    id: "frost",
    name: "Frost",
    description: "Cool slate with an icy mint accent.",
    vars: { ...base("#0a0d0f", "#0f1417", "#141a1e", "#1c2429", "#263137", "#3e4e57"), "--color-accent": "#7ff0e0", "--color-accent-hover": "#a3f5ea", "--color-accent-text": "#8ff2e4", "--color-on-accent": "#04110f", "--focus-glow": "rgb(127 240 224 / 0.28)" },
  },
];

export const DEFAULT_THEME: ThemeId = "lime";

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Apply a theme to the whole page by overriding the colour variables on <html>. */
export function applyTheme(id: string | undefined) {
  const t = themeById(id), root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
}
