import { useNavigate } from "react-router";
import { Button, Section, Slider, Toggle } from "../components/controls";
import { Screen } from "../components/Screen";
import { WallpaperPicker } from "../components/WallpaperPicker";
import { useSettings } from "../stores/settings";

export default function SettingsScreen() {
  const s = useSettings();
  const navigate = useNavigate();

  return (
    <Screen title="Settings" subtitle="Saved on this device.">
      <div className="grid max-w-4xl gap-2">
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
