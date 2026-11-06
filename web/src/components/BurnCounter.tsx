import { useEffect, useRef, useState } from "react";
import { refreshActivity, useActivity } from "../arcade/activity";
import { hasVoting, useArcade } from "../arcade/store";
import { prefersReducedMotion } from "../stores/settings";

/** "Total $WIF burned" with a count-up whenever the total grows. */
export function BurnCounter({ className = "" }: { className?: string }) {
  const burned = useActivity((s) => s.totals.burned);
  const mode = useArcade((s) => s.mode);
  const decimals = useArcade((s) => s.decimals);
  const target = Number(burned / 10n ** BigInt(Math.max(0, decimals - 2))) / 100;
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (hasVoting(mode) && burned === 0n) void refreshActivity();
  }, [mode, burned]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now(), a = from.current, dur = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = a + (target - a) * e;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (!hasVoting(mode)) return null;
  return (
    <div className={`rounded-xl border border-accent-2/40 bg-accent-2/10 px-4 py-3 ${className}`} aria-live="polite">
      <div className="text-sm font-bold uppercase tracking-wide text-accent-2">Total $WIF burned{mode === "demo" ? " (demo)" : ""}</div>
      <div className="font-display text-3xl font-extrabold tabular-nums">
        {Math.round(shown).toLocaleString("en-US")} <span className="text-lg text-muted">WIF</span>
      </div>
    </div>
  );
}
