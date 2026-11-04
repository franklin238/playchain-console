import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/controls";
import { Screen } from "../components/Screen";
import { onAction, type InputAction, type InputSource } from "../input/dispatcher";
import { BUTTON_NAMES, onPadState, type PadSnapshot } from "../input/gamepad";
import { useInputLayer } from "../input/hooks";

interface LogEntry {
  id: number;
  action: InputAction;
  source: InputSource;
}

function Stick({ x, y, pressed, label }: { x: number; y: number; pressed: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative size-24 rounded-full border-2 ${pressed ? "border-accent" : "border-line-strong"} bg-bg-2`}>
        <div
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
          style={{ left: `${50 + x * 40}%`, top: `${50 + y * 40}%` }}
        />
      </div>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

export default function ControllerTestScreen() {
  const navigate = useNavigate();
  const [pads, setPads] = useState<PadSnapshot[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => onPadState(setPads), []);
  useEffect(
    () =>
      onAction((action, source) =>
        setLog((prev) => [{ id: Date.now() + Math.random(), action, source }, ...prev].slice(0, 8)),
      ),
    [],
  );

  // While testing, the controller's B and Start buttons are only logged.
  // Leave with the button on screen, Escape, or the mouse.
  useInputLayer((action, source) => source === "gamepad" && (action === "back" || action === "menu"), 20);

  const pad = pads[0];

  return (
    <Screen
      title="Controller test"
      subtitle="Press buttons and move the sticks. Keyboard: arrows, Enter, Escape, M. While testing, the controller's B and Start buttons are only shown here."
      actions={
        <Button icon="chevronLeft" onClick={() => navigate("/settings")} data-nav-default="">
          Leave test
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-line bg-surface p-6">
          {!pad ? (
            <p className="text-muted">No controller detected. Connect one and press any button.</p>
          ) : (
            <>
              <p className="mb-5 break-all">
                <span className="text-muted">Controller {pad.index + 1}:</span> {pad.id}
                <span className="ml-3 text-muted">({pad.mapping || "non-standard"} mapping)</span>
              </p>
              <div className="mb-6 flex flex-wrap gap-2">
                {BUTTON_NAMES.map((name, i) => (
                  <span
                    key={name}
                    className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                      pad.buttons[i] ? "bg-accent text-on-accent" : "bg-white/8 text-muted"
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex gap-12">
                <Stick x={pad.axes[0] ?? 0} y={pad.axes[1] ?? 0} pressed={!!pad.buttons[10]} label="Left stick" />
                <Stick x={pad.axes[2] ?? 0} y={pad.axes[3] ?? 0} pressed={!!pad.buttons[11]} label="Right stick" />
              </div>
              {pads.length > 1 && <p className="mt-6 text-muted">{pads.length} controllers connected.</p>}
            </>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-4 font-bold">Last actions</h2>
          {log.length === 0 && <p className="text-muted">None yet.</p>}
          <ul className="grid gap-2">
            {log.map((e) => (
              <li key={e.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5">
                <span className="font-semibold capitalize">{e.action}</span>
                <span className="text-muted">{e.source}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Screen>
  );
}
