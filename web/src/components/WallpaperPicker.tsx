import { useRef, useState, type ChangeEvent } from "react";
import { useSettings } from "../stores/settings";
import { useWallpaper } from "../stores/wallpaper";
import { DEFAULT_WALLPAPER, WALLPAPERS, type WallpaperId } from "../wallpapers/catalog";
import { WallpaperView } from "../wallpapers/Wallpaper";
import { Button, Slider } from "./controls";
import { Icon } from "./Icon";

/** Settings: choose a wallpaper or use your own picture. */
export function WallpaperPicker() {
  const { wallpaper, wallpaperDim, wallpaperBlur, set } = useSettings();
  const { customUrl, setCustom, removeCustom } = useWallpaper();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (id: WallpaperId) => {
    setError(null);
    if (id === "custom" && !customUrl) {
      fileRef.current?.click();
      return;
    }
    set({ wallpaper: id });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await setCustom(file);
      // Photos are often bright; start dimmed so text stays readable.
      set({ wallpaper: "custom", wallpaperDim: Math.max(wallpaperDim, 35) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that image.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await removeCustom();
    if (wallpaper === "custom") set({ wallpaper: DEFAULT_WALLPAPER });
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Wallpaper">
        {WALLPAPERS.map((w) => {
          const selected = wallpaper === w.id && (w.id !== "custom" || !!customUrl);
          return (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-wallpaper-option={w.id}
              onClick={() => choose(w.id)}
              className={`overflow-hidden rounded-xl border-2 bg-surface text-left transition-colors ${
                selected ? "border-fg" : "border-line hover:border-line-strong"
              }`}
            >
              <div className="relative aspect-video">
                <WallpaperView id={w.id} preview blur={wallpaperBlur} />
                {w.id === "custom" && !customUrl && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 text-sm font-bold uppercase tracking-wide">
                      <Icon name="upload" className="size-[1.1em]" /> {busy ? "Preparing…" : "Upload"}
                    </span>
                  </span>
                )}
                {selected && (
                  <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-fg text-bg">
                    <Icon name="check" className="size-[1em]" />
                  </span>
                )}
              </div>
              <div className="px-3 py-2.5">
                <div className="font-bold">{w.name}</div>
                <div className="text-sm text-muted">
                  {w.note}
                  {w.animated ? " · Animated" : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose a wallpaper image"
        className="hidden"
        onChange={(e) => void onFile(e)}
      />

      {customUrl && (
        <div className="flex flex-wrap gap-3">
          <Button icon="image" onClick={() => fileRef.current?.click()} disabled={busy}>
            Change image
          </Button>
          <Button icon="x" onClick={() => void remove()} disabled={busy}>
            Remove image
          </Button>
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-5 py-3 text-danger" role="alert">
          {error}
        </p>
      )}

      <Slider label="Dim" value={wallpaperDim} max={80} onChange={(v) => set({ wallpaperDim: v })} format={(v) => `${v}%`} />
      {wallpaper === "custom" && customUrl && (
        <Slider label="Blur" value={wallpaperBlur} max={30} step={2} onChange={(v) => set({ wallpaperBlur: v })} format={(v) => `${v}px`} />
      )}
      <p className="text-sm text-muted">
        Your own image stays on this device and is never uploaded. Animated wallpapers stand still when Reduce motion is on,
        and pause while a game is running.
      </p>
    </div>
  );
}
