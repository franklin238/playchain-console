/** The PlayChain Flat flywheel as one diagram (README, About page and demo video use the same loop). */
const STEPS = [
  { t: "Developers list games", d: "Listing fee burns in full", c: "var(--color-accent-2)" },
  { t: "Players play and vote", d: "Half of every vote burns", c: "var(--color-accent-2)" },
  { t: "Developers earn 40%", d: "Paid in the same transaction", c: "var(--color-accent)" },
  { t: "Developers promote", d: "To win the daily Spotlight", c: "var(--color-accent)" },
  { t: "New Spotlight daily", d: "A reason to come back", c: "var(--color-teal)" },
  { t: "More games, more votes", d: "More burn, more income", c: "var(--color-teal)" },
];

export function Flywheel() {
  const cx = 320;
  const cy = 300;
  const r = 205;
  return (
    <svg viewBox="0 0 640 600" className="mx-auto w-full max-w-xl" role="img" aria-label="Flywheel: developers list games, players vote, half burns, developers earn, promote for the Spotlight, a new Spotlight each day brings players back.">
      <defs>
        <marker id="fw-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--color-muted)" />
        </marker>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth="2" strokeDasharray="6 8" />
      {STEPS.map((_, i) => {
        const a0 = ((i * 60 - 90 + 16) * Math.PI) / 180;
        const a1 = (((i + 1) * 60 - 90 - 16) * Math.PI) / 180;
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
        const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        return (
          <path
            key={`a${i}`}
            d={`M${p0[0]} ${p0[1]} A${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth="2.5"
            markerEnd="url(#fw-arrow)"
          />
        );
      })}
      <g>
        <circle cx={cx} cy={cy} r="78" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--color-fg)" fontSize="26" fontWeight="800">
          $WIF
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--color-muted)" fontSize="15">
          burned on every action
        </text>
      </g>
      {STEPS.map((s, i) => {
        const a = ((i * 60 - 90) * Math.PI) / 180;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        return (
          <g key={s.t} transform={`translate(${x} ${y})`}>
            <rect x="-96" y="-34" width="192" height="68" rx="14" fill="var(--color-bg-2)" stroke={s.c} strokeWidth="2" />
            <text x="0" y="-6" textAnchor="middle" fill="var(--color-fg)" fontSize="16" fontWeight="800">
              {s.t}
            </text>
            <text x="0" y="16" textAnchor="middle" fill="var(--color-muted)" fontSize="13">
              {s.d}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
