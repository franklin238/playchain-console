// "I voted" share card: a 1200x630 image drawn in the browser (the size X shows best), and a
// ready-written X post. Nothing is uploaded anywhere; the player saves or shares it themselves.

export interface VoteCard {
  game: string;
  cover: string;
  amount: string;
  burned: string;
  toDev: string;
  burnPct: number;
  devPct: number;
  link: string;
}

const W = 1200, H = 630;
const FONT = '"Plus Jakarta Sans Variable", "Segoe UI", system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Shrinks the font until `text` fits in `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number): number {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(text).width <= max) break;
    s -= 2;
  } while (s > 16);
  return s;
}

export async function drawVoteCard(card: VoteCard): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    await Promise.all([document.fonts.load(`800 64px ${FONT}`), document.fonts.load(`600 28px ${FONT}`)]);
  } catch {
    /* the system font is fine */
  }
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--color-accent").trim() || "#c8ff4d";
  const accent2 = css.getPropertyValue("--color-accent-2").trim() || "#ff7a3d";

  ctx.fillStyle = "#0b0d0c";
  ctx.fillRect(0, 0, W, H);
  const img = await loadImage(card.cover);
  if (img) {
    // Cover art on the right, fading into the dark panel on the left.
    const h = H, w = (img.width / img.height) * h;
    ctx.drawImage(img, W - w + w * 0.12, 0, w, h);
    const g = ctx.createLinearGradient(W - w + w * 0.12, 0, W - w * 0.35, 0);
    g.addColorStop(0, "#0b0d0c");
    g.addColorStop(1, "rgba(11,13,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0.55, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  const left = 72, max = 640;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText("I JUST VOTED", left, 132);

  ctx.fillStyle = "#f3f3f3";
  fit(ctx, `${card.amount} $WIF`, 800, 96, max);
  ctx.fillText(`${card.amount} $WIF`, left, 236);

  ctx.fillStyle = "rgba(243,243,243,0.85)";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("for", left, 296);
  ctx.fillStyle = "#f3f3f3";
  fit(ctx, card.game, 800, 56, max);
  ctx.fillText(card.game, left, 360);

  // The split, as two chips.
  ctx.font = `700 26px ${FONT}`;
  let x = left;
  for (const [text, color] of [
    [`${card.burned} burned (${card.burnPct}%)`, accent2],
    [`${card.toDev} to the developer (${card.devPct}%)`, accent],
  ] as const) {
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(x, 400, w, 50, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x + 18, 434);
    x += w + 14;
    if (x > left + max) break;
  }

  // Wordmark and link.
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = "#f3f3f3";
  ctx.fillText("PLAY", left, 552);
  const playW = ctx.measureText("PLAY").width;
  ctx.fillStyle = accent;
  ctx.fillText("CHAIN", left + playW, 552);
  ctx.fillStyle = "rgba(243,243,243,0.7)";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(card.link.replace(/^https:\/\//, ""), left, 590);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Shares the card through the phone's share sheet when it can, otherwise downloads it. */
export async function saveVoteCard(card: VoteCard, fileName: string): Promise<"shared" | "saved" | "failed"> {
  const blob = await drawVoteCard(card);
  if (!blob) return "failed";
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText(card) });
      return "shared";
    } catch {
      /* cancelled: fall through to saving */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "saved";
}

export function shareText(card: VoteCard): string {
  return `I just voted ${card.amount} $WIF for ${card.game} on PlayChain 🎮 ${card.burnPct}% burned, ${card.devPct}% straight to the developer. Play free:`;
}

/** A ready-written X post with the game's link. */
export function shareOnXUrl(card: VoteCard): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(shareText(card))}&url=${encodeURIComponent(card.link)}`;
}
