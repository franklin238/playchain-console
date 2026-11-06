/** The PlayChain Flat flywheel as one diagram (README, About page and demo video use the same loop, spec section 4). */
const STEPS = [
  { t: "Developers list games", d: "Listing fee burns in full", c: "var(--color-accent-2)" },
  { t: "Players vote with $WIF", d: "Half of every vote burns", c: "var(--color-accent-2)" },
  { t: "Developers earn 40%", d: "Paid in the same vote", c: "var(--color-accent)" },
  { t: "Developers promote", d: "To win the daily Spotlight", c: "var(--color-accent)" },
  { t: "New Spotlight daily", d: "Players come back to vote", c: "var(--color-teal)" },
];

// Geometry in viewBox units. Boxes sit on a pentagon around the core.
const W = 660;
const H = 500;
const CX = W / 2;
const CY = 270;
const R = 220;
const BW = 200;
const BH = 76;
const CORE_R = 80;
const GAP = 10;

const points = STEPS.map((_, i) => {
  const a = ((i * 72 - 90) * Math.PI) / 180;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
});

/** Where the line from a box centre towards (dx, dy) leaves the box, plus a small gap. */
function exitDistance(dx: number, dy: number): number {
  const len = Math.hypot(dx, dy);
  const t = Math.min(dx ? BW / 2 / Math.abs(dx) : Infinity, dy ? BH / 2 / Math.abs(dy) : Infinity);
  return t * len + GAP;
}

const arrows = points.map((p, i) => {
  const q = points[(i + 1) % points.length];
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const d = exitDistance(dx, dy);
  return { x1: p.x + ux * d, y1: p.y + uy * d, x2: q.x - ux * d, y2: q.y - uy * d };
});

const LABEL =
  "Flywheel: developers burn $WIF to list games, players vote with $WIF and half burns, developers earn 40% of each vote, developers promote to win the daily Spotlight, and a new Spotlight each day brings players back to vote.";

export function Flywheel() {
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto hidden w-full max-w-2xl sm:block" role="img" aria-label={LABEL}>
        <defs>
          <marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="var(--color-muted)" />
          </marker>
        </defs>
        {arrows.map((a, i) => (
          <line
            key={`a${i}`}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="var(--color-muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            markerEnd="url(#fw-arrow)"
          />
        ))}
        <g className="flywheel-core">
          <circle cx={CX} cy={CY} r={CORE_R} fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2.5" />
          <text textAnchor="middle" dominantBaseline="middle" fill="var(--color-fg)">
            <tspan x={CX} y={CY - 18} fontSize="28" fontWeight="800">
              $WIF
            </tspan>
            <tspan x={CX} y={CY + 14} fontSize="14" fill="var(--color-muted)">
              burned on
            </tspan>
            <tspan x={CX} y={CY + 33} fontSize="14" fill="var(--color-muted)">
              every action
            </tspan>
          </text>
        </g>
        {STEPS.map((s, i) => (
          <g key={s.t} transform={`translate(${points[i].x} ${points[i].y})`}>
            <rect x={-BW / 2} y={-BH / 2} width={BW} height={BH} rx="14" fill="var(--color-bg-2)" stroke={s.c} strokeWidth="2" />
            <text x="0" y="-11" textAnchor="middle" dominantBaseline="middle" fill="var(--color-fg)" fontSize="15" fontWeight="800">
              {s.t}
            </text>
            <text x="0" y="13" textAnchor="middle" dominantBaseline="middle" fill="var(--color-muted)" fontSize="12.5">
              {s.d}
            </text>
          </g>
        ))}
      </svg>

      {/* Phones: the same loop as a vertical list, so nothing shrinks below a readable size. */}
      <ol className="grid gap-2 sm:hidden" aria-label={LABEL}>
        <li className="flywheel-core mx-auto mb-2 grid size-32 place-items-center rounded-full border-2 border-accent bg-surface text-center">
          <span>
            <span className="block font-display text-2xl font-extrabold">$WIF</span>
            <span className="block text-sm leading-tight text-muted">
              burned on
              <br />
              every action
            </span>
          </span>
        </li>
        {STEPS.map((s, i) => (
          <li key={s.t} className="grid justify-items-center gap-2">
            <div className="w-full rounded-xl border-2 bg-bg-2 px-4 py-3 text-center" style={{ borderColor: s.c }}>
              <div className="font-extrabold">{s.t}</div>
              <div className="text-sm text-muted">{s.d}</div>
            </div>
            <span aria-hidden="true" className="text-muted">
              {i < STEPS.length - 1 ? "↓" : "↺ back to the top"}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
