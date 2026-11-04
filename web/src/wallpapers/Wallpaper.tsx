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
    case "charcoal":
      return null;
  }
}

const DESIGNED: WallpaperId[] = ["aurora", "rain", "nebula", "neon", "embers", "silk"];

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
