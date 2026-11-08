import { useMemo, type CSSProperties } from "react";
import { useArcade } from "../arcade/store";
import { useSettings } from "../stores/settings";
import { useWallpaper } from "../stores/wallpaper";
import { DEFAULT_WALLPAPER, isWallpaperId, type WallpaperId } from "./catalog";
import "./wallpapers.css";

/** Small deterministic random generator so particles look the same every time. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EMBERS = (() => {
  const rand = seeded(42);
  return Array.from({ length: 26 }, () => ({
    "--x": `${(rand() * 100).toFixed(1)}%`,
    "--s": `${(2 + rand() * 3.5).toFixed(1)}px`,
    "--d": `${(9 + rand() * 10).toFixed(1)}s`,
    "--delay": `${(-rand() * 19).toFixed(1)}s`,
    "--dx": `${((rand() - 0.5) * 18).toFixed(1)}cqw`,
  })) as CSSProperties[];
})();

/** Seeded particles for the falling and rising wallpapers (bubbles, petals, snow, fireflies). */
function particles(seed: number, n: number, size: [number, number], dur: [number, number], drift = 18) {
  const rand = seeded(seed);
  return Array.from({ length: n }, () => ({
    "--x": `${(rand() * 100).toFixed(1)}%`,
    "--y": `${(rand() * 100).toFixed(1)}%`,
    "--s": `${(size[0] + rand() * (size[1] - size[0])).toFixed(1)}px`,
    "--d": `${(dur[0] + rand() * (dur[1] - dur[0])).toFixed(1)}s`,
    "--delay": `${(-rand() * dur[1]).toFixed(1)}s`,
    "--dx": `${((rand() - 0.5) * drift).toFixed(1)}cqw`,
    "--r": `${Math.round(rand() * 360)}deg`,
  })) as CSSProperties[];
}
const BUBBLES = particles(7, 22, [3, 9], [10, 20], 6);
const PETALS = particles(11, 24, [6, 11], [12, 22], 30);
const SNOW = particles(23, 60, [1.5, 4.5], [9, 18], 12);
const FIREFLIES = particles(31, 28, [2.5, 4.5], [5, 11], 10);
const PRISM = (() => {
  const rand = seeded(5), hues = [190, 260, 320, 30, 160, 220];
  return Array.from({ length: 14 }, (_, i) => ({
    left: `${(rand() * 100).toFixed(1)}%`,
    top: `${(rand() * 100).toFixed(1)}%`,
    width: `${(18 + rand() * 30).toFixed(0)}cqmin`,
    height: `${(18 + rand() * 30).toFixed(0)}cqmin`,
    background: `linear-gradient(${Math.round(rand() * 360)}deg, hsl(${hues[i % 6]} 80% 55% / 0.22), hsl(${hues[(i + 2) % 6]} 80% 45% / 0.04))`,
    animationDuration: `${(30 + rand() * 40).toFixed(0)}s`,
    animationDelay: `${(-rand() * 60).toFixed(0)}s`,
    ["--r" as string]: `${Math.round(rand() * 360)}deg`,
  })) as CSSProperties[];
})();
const CIRCUIT = (() => {
  const rand = seeded(9), lines: { d: string; len: number; dur: number; delay: number }[] = [];
  for (let i = 0; i < 26; i++) {
    let x = Math.round(rand() * 16) * 100, y = Math.round(rand() * 10) * 100, d = `M${x},${y}`, len = 0;
    for (let k = 0; k < 5; k++) {
      const step = (Math.round(rand() * 3) + 1) * 100 * (rand() < 0.5 ? -1 : 1);
      if (k % 2 === 0) x += step; else y += step;
      d += ` L${x},${y}`; len += Math.abs(step);
    }
    lines.push({ d, len, dur: 4 + rand() * 6, delay: -rand() * 10 });
  }
  return lines;
})();
const PINES = (() => {
  const rand = seeded(17);
  return Array.from({ length: 26 }, (_, i) => ({ x: i * 64 + rand() * 30, h: 140 + rand() * 160 }));
})();

function Peaks() {
  return (
    <svg className="peaks" viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path fill="#1b2340" d="M0 500V300l120-90 110 70 160-170 140 120 120-60 170 150 140-110 180 130 150-140 130 90 180-80V500z" />
      <path fill="#121a30" d="M0 500V370l140-60 150 80 190-130 160 110 170-70 180 120 160-90 200 100 150-60 100 40V500z" />
      <path fill="#0a1020" d="M0 500V430l180-40 200 50 220-70 200 60 230-50 220 60 200-40 150 20V500z" />
      <path fill="rgb(230 236 255 / 0.55)" d="M390 140l-40 40 25-5 15 18 20-22 18 12zM870 230l-35 30 20-3 15 14 18-18z" />
    </svg>
  );
}
function Dunes() {
  return (
    <svg className="dunes" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path fill="#7a3a24" d="M0 400V220c200-60 380-70 560-10s380 40 560-30 340-60 480-10V400z" />
      <path fill="#5a2a1a" d="M0 400V290c220-50 420-30 620 20s420 20 600-40 260-30 380 0V400z" />
      <path fill="#3a1a12" d="M0 400V350c260-30 520-10 800 15s520 0 800-30V400z" />
    </svg>
  );
}
function Pines() {
  return (
    <svg className="pines" viewBox="0 0 1700 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {PINES.map((t, i) => (
        <path key={i} fill={i % 3 ? "#06120c" : "#0a1a12"} d={`M${t.x - t.h * 0.22} ${400 - t.h * 0.12} L${t.x} ${400 - t.h} L${t.x + t.h * 0.22} ${400 - t.h * 0.12} L${t.x + 6} ${400 - t.h * 0.12} L${t.x + 6} 400 L${t.x - 6} 400 L${t.x - 6} ${400 - t.h * 0.12}Z`} />
      ))}
    </svg>
  );
}

const SILK_PATHS = (() => {
  const lines: { d: string; stroke: string }[] = [];
  for (let i = 0; i < 34; i++) {
    const base = 90 + i * 25;
    const amp = 55 + 45 * Math.sin(i * 0.31);
    const freq = 0.0032 + i * 0.00005;
    const phase = i * 0.22;
    let d = "";
    for (let x = 0; x <= 1600; x += 32) {
      const y = base + amp * Math.sin(x * freq + phase) + 22 * Math.sin(x * freq * 2.3 + phase * 1.7);
      d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`;
    }
    const accent = i % 8 === 4;
    lines.push({ d, stroke: accent ? "rgb(255 90 110 / 0.38)" : `rgb(255 255 255 / ${(0.035 + (i % 5) * 0.013).toFixed(3)})` });
  }
  return lines;
})();

function City() {
  return (
    <svg className="city" viewBox="0 0 1280 240" preserveAspectRatio="none" aria-hidden="true">
      <path
        fill="#03040a"
        d="M0 150h70v-60h50v40h40V40h70v100h40V90h80v70h40V20h20V0h40v20h20v140h60V90h70v80h50V50h80v100h60V100h60v70h70V60h50v90h60V110h70v130H0z"
      />
      <g fill="#f5d28a" fillOpacity="0.55">
        <rect x="190" y="70" width="7" height="10" />
        <rect x="214" y="100" width="7" height="10" />
        <rect x="455" y="40" width="7" height="10" />
        <rect x="690" y="130" width="7" height="10" />
        <rect x="905" y="75" width="7" height="10" />
        <rect x="930" y="105" width="7" height="10" />
        <rect x="1190" y="140" width="7" height="10" />
      </g>
    </svg>
  );
}

function Hills() {
  return (
    <svg className="hills" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 100L0 70 90 38 160 66 240 22 330 74 420 46 500 80 590 30 680 70 760 40 860 76 930 50 1000 64 1000 100Z"
        fill="#16031c"
        stroke="rgb(255 46 136 / 0.5)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Layers({ id, preview, customUrl, artUrl, blur }: { id: WallpaperId; preview: boolean; customUrl: string | null; artUrl: string; blur: number }) {
  switch (id) {
    case "aurora":
      return (
        <>
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="blob b3" />
          <div className="ribbon" />
        </>
      );
    case "rain":
      return (
        <>
          <div className="glow" />
          <div className="lamp" />
          <div className="rain-box">
            <div className="rain far" />
            <div className="rain" />
          </div>
          <City />
        </>
      );
    case "nebula":
      return (
        <>
          <div className="cloud" />
          <div className="stars s1" />
          <div className="stars s2" />
          <div className="stars s3" />
        </>
      );
    case "neon":
      return (
        <>
          <div className="haze" />
          <div className="sun" />
          <Hills />
          <div className="floor">
            <div className="grid" />
          </div>
        </>
      );
    case "embers":
      return (
        <>
          {EMBERS.map((style, i) => (
            <span key={i} className="p" style={style} />
          ))}
        </>
      );
    case "silk":
      return (
        <svg className="waves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {SILK_PATHS.map((p, i) => (
            <path key={i} d={p.d} fill="none" stroke={p.stroke} strokeWidth="1.3" />
          ))}
        </svg>
      );
    case "game-art":
      return (
        <>
          <img src={artUrl} alt="" style={{ ["--wp-blur" as string]: preview ? "10px" : "48px" }} />
          <div className="shade" />
        </>
      );
    case "custom":
      return customUrl ? (
        <img
          src={customUrl}
          alt=""
          style={{
            filter: blur ? `blur(${preview ? Math.ceil(blur / 4) : blur}px)` : undefined,
            transform: blur ? "scale(1.06)" : undefined,
          }}
        />
      ) : null;
    case "ocean":
      return (
        <>
          <div className="rays" />
          {BUBBLES.map((style, i) => <span key={i} className="p" style={style} />)}
        </>
      );
    case "sakura":
      return (
        <>
          <div className="moon" />
          <div className="branch" />
          {PETALS.map((style, i) => <span key={i} className="p" style={style} />)}
        </>
      );
    case "peaks":
      return (
        <>
          <div className="stars s1" />
          <div className="moon" />
          <Peaks />
        </>
      );
    case "circuit":
      return (
        <svg className="board" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {CIRCUIT.map((l, i) => (
            <g key={i}>
              <path d={l.d} fill="none" stroke="rgb(60 255 180 / 0.08)" strokeWidth="2" />
              <path d={l.d} fill="none" stroke="rgb(90 255 200 / 0.75)" strokeWidth="2.5" strokeLinecap="round" className="pulse"
                style={{ strokeDasharray: `60 ${l.len}`, ["--len" as string]: `${l.len + 60}`, animationDuration: `${l.dur.toFixed(1)}s`, animationDelay: `${l.delay.toFixed(1)}s` }} />
            </g>
          ))}
        </svg>
      );
    case "dunes":
      return (
        <>
          <div className="sun" />
          <Dunes />
        </>
      );
    case "snow":
      return (
        <>
          <div className="glow" />
          {SNOW.map((style, i) => <span key={i} className="p" style={style} />)}
        </>
      );
    case "lava":
      return (
        <>
          <div className="blob l1" />
          <div className="blob l2" />
          <div className="blob l3" />
          <div className="blob l4" />
        </>
      );
    case "prism":
      return <>{PRISM.map((style, i) => <span key={i} className="shard" style={style} />)}</>;
    case "fireflies":
      return (
        <>
          <div className="mist" />
          <Pines />
          {FIREFLIES.map((style, i) => <span key={i} className="p" style={style} />)}
        </>
      );
    case "charcoal":
      return null;
  }
}

const DESIGNED: WallpaperId[] = ["aurora", "rain", "nebula", "neon", "embers", "silk", "ocean", "sakura", "peaks", "circuit", "dunes", "snow", "lava", "prism", "fireflies"];

/** One wallpaper, sized to its container (full screen or a Settings preview). */
export function WallpaperView({
  id,
  preview = false,
  dim = 0,
  blur = 0,
}: {
  id: WallpaperId;
  preview?: boolean;
  dim?: number;
  blur?: number;
}) {
  const customUrl = useWallpaper((s) => s.customUrl);
  const artUrl = useWallpaper((s) => s.artUrl);
  const featuredCover = useArcade((s) => s.games.find((g) => g.key === s.spotlight?.key)?.meta?.cover);
  const art = artUrl ?? featuredCover ?? "/covers/neon-tide.svg";

  const className = id === "custom" ? (customUrl ? "wp-image" : "wp-empty") : id === "game-art" ? "wp-art" : `wp-${id}`;

  return (
    <div className={`wp ${className}`} aria-hidden="true">
      <Layers id={id} preview={preview} customUrl={customUrl} artUrl={art} blur={blur} />
      {DESIGNED.includes(id) && (
        <>
          <div className="wp-grain" />
          <div className="wp-vignette" />
        </>
      )}
      {!preview && <div className="wp-scrim" />}
      {!preview && dim > 0 && <div className="wp-dim" style={{ opacity: dim / 100 }} />}
    </div>
  );
}

/** The console's full-screen background. */
export function Wallpaper() {
  const chosen = useSettings((s) => s.wallpaper);
  const dim = useSettings((s) => s.wallpaperDim);
  const blur = useSettings((s) => s.wallpaperBlur);
  const hasCustom = useWallpaper((s) => !!s.customUrl);
  const id = useMemo<WallpaperId>(() => {
    if (!isWallpaperId(chosen)) return DEFAULT_WALLPAPER;
    if (chosen === "custom" && !hasCustom) return DEFAULT_WALLPAPER;
    return chosen;
  }, [chosen, hasCustom]);

  return (
    <div className="wp-fixed" data-testid="wallpaper" data-wallpaper={id}>
      <WallpaperView id={id} dim={dim} blur={blur} />
    </div>
  );
}
