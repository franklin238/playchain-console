import { useCallback, useEffect, useRef, useState } from "react";
import { consoleConfig } from "../config/console.config";
import { useInputLayer } from "../input/hooks";
import { prefersReducedMotion } from "../stores/settings";

const STEPS = ["Starting console", "Reaching Robinhood Chain", "Reading the arcade", "Ready"];

/** Logo animation and short loading sequence. Under 4 seconds, skippable. */
export function BootScreen({ onDone }: { onDone: () => void }) {
  const reduce = prefersReducedMotion();
  const duration = reduce ? 900 : consoleConfig.bootDurationMs;
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.setTimeout(onDone, reduce ? 0 : 320);
  }, [onDone, reduce]);

  useEffect(() => {
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i), (duration / STEPS.length) * i));
    timers.push(window.setTimeout(finish, duration));
    // Any key, click or tap skips.
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [duration, finish]);

  // Any controller button skips too, and nothing underneath reacts meanwhile.
  useInputLayer(() => {
    finish();
    return true;
  }, 100);

  return (
    <div
      role="status"
      aria-label="Starting PlayChain Flat. Press any button to skip."
      data-testid="boot-screen"
      className={`fixed inset-0 z-[100] grid place-items-center bg-bg transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <div className="aurora" aria-hidden="true" />
      <div className="flex flex-col items-center gap-8">
        <svg viewBox="0 0 64 64" className="size-20" aria-hidden="true">
          <defs>
            <linearGradient id="boot-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4de1c1" />
              <stop offset="1" stopColor="#c8ff4d" />
            </linearGradient>
          </defs>
          <path
            d="M20 16h16a12 12 0 0 1 0 24h-8v8h-8z"
            fill="none"
            stroke="url(#boot-g)"
            strokeWidth={5}
            strokeLinejoin="round"
            className="boot-draw"
          />
        </svg>
        <div className="flex font-display text-3xl font-extrabold tracking-[0.22em] sm:text-5xl">
          {consoleConfig.name.toUpperCase().split("").map((ch, i) => (
            <span key={i} className="boot-letter" style={{ animationDelay: `${300 + i * 70}ms` }}>
              {ch === " " ? "\u00a0" : ch}
            </span>
          ))}
        </div>
        <div className="flex w-64 flex-col items-center gap-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="boot-bar h-full rounded-full bg-accent" style={{ animationDuration: `${duration}ms` }} />
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted" aria-live="polite">
            {STEPS[step]}
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 text-sm text-muted">Press any button to skip</div>
    </div>
  );
}
