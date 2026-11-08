import { useNavigate } from "react-router";
import { Button, Section, Slider, Toggle } from "../components/controls";
import { Screen } from "../components/Screen";
import { WallpaperPicker } from "../components/WallpaperPicker";
import { MUSIC_TRACKS } from "../audio/engine";
import { enterFullscreen, exitFullscreen } from "../components/FullscreenControl";
import { useSettings } from "../stores/settings";
import { THEMES } from "../theme/themes";

export default function SettingsScreen() {
  const s = useSettings();
  const navigate = useNavigate();

  return (
    <Screen title="Settings" subtitle="Saved on this device.">
      <div className="grid max-w-4xl gap-2">
        <Section title="Theme">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => {
              const on = s.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => s.set({ theme: t.id })}
                  className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${on ? "border-fg" : "border-line hover:border-line-strong"}`}
                  style={{ background: t.vars["--color-surface"] }}
                >
                  <div className="flex h-16 items-end gap-1.5 p-2.5" style={{ background: `linear-gradient(135deg, ${t.vars["--color-bg"]}, ${t.vars["--color-surface-2"]})` }}>
                    <span className="h-8 w-8 rounded-lg" style={{ background: t.vars["--color-accent"] }} />
                    <span className="h-5 w-12 rounded-md" style={{ background: t.vars["--color-line-strong"] }} />
                    <span className="h-5 w-6 rounded-md" style={{ background: t.vars["--color-line"] }} />
                  </div>
                  <div className="px-3 py-2">
                    <span className="block font-bold" style={{ color: on ? t.vars["--color-accent"] : undefined }}>{t.name}{on ? " ✓" : ""}</span>
                    <span className="block text-sm text-muted">{t.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Music">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Menu music">
            {MUSIC_TRACKS.map((m) => {
              const on = s.musicTrack === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => s.set({ musicTrack: m.id, muted: false })}
                  className={`flex items-center gap-3 rounded-xl border-2 bg-surface px-4 py-3 text-left transition-colors ${on ? "border-accent" : "border-line hover:border-line-strong"}`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${on ? "bg-accent text-on-accent" : "bg-white/10"}`}>{on ? "♪" : "▶"}</span>
                  <span>
                    <span className="block font-bold">{m.name} <span className="text-sm font-normal text-muted">· {m.bpm} BPM</span></span>
                    <span className="block text-sm text-muted">{m.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Display">
          <Toggle
            label="Open in fullscreen"
            description="PlayChain goes fullscreen on your first click or key press. Esc always means back, in menus and in games. To return to a window, use the fullscreen button in the top bar, the ✕ in the corner, or the PlayChain menu in a game (or hold Esc for two seconds)."
            checked={s.autoFullscreen}
            onChange={(autoFullscreen) => s.set({ autoFullscreen })}
          />
          <div className="flex gap-3">
            <Button className="justify-start self-start" onClick={() => enterFullscreen()}>Go fullscreen</Button>
            <Button className="justify-start self-start" onClick={() => exitFullscreen()}>Leave fullscreen</Button>
          </div>
        </Section>

        <Section title="Background">
          <WallpaperPicker />
        </Section>

        <Section title="Sound">
          <Slider label="Music" value={s.musicVolume} onChange={(musicVolume) => s.set({ musicVolume })} format={(v) => `${v}%`} />
          <Slider label="Effects" value={s.sfxVolume} onChange={(sfxVolume) => s.set({ sfxVolume })} format={(v) => `${v}%`} />
          <Toggle label="Mute all sound" checked={s.muted} onChange={(muted) => s.set({ muted })} />
        </Section>

        <Section title="Accessibility">
          <Toggle
            label="Reduce motion"
            description="Turns off animations. Your system's reduce-motion setting is always respected too."
            checked={s.reduceMotion}
            onChange={(reduceMotion) => s.set({ reduceMotion })}
          />
        </Section>

        <Section title="Controller">
          <Button icon="gamepad" className="justify-start self-start" onClick={() => navigate("/settings/controller")}>
            Controller test
          </Button>
        </Section>
      </div>
    </Screen>
  );
}
