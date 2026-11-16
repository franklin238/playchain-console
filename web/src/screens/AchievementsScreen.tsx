import { useNavigate } from "react-router";
import { shelfGames, useArcade } from "../arcade/store";
import { Section } from "../components/controls";
import { Footer } from "../components/Footer";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { localize } from "../games/meta";
import { ACHIEVEMENTS, bestScore, useProgress } from "../stores/progress";

export default function AchievementsScreen() {
  const p = useProgress();
  const games = useArcade((s) => s.games);
  const navigate = useNavigate();
  const got = ACHIEVEMENTS.filter((a) => p.unlocked[a.id]).length;
  const shelf = shelfGames(games);

  return (
    <Screen title="Achievements" subtitle={`${got} of ${ACHIEVEMENTS.length} unlocked. Play, vote and explore to collect them all. They're kept in this browser.`}>
      <div className="mb-8 h-3 max-w-xl overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length} aria-valuenow={got} aria-label="Achievements unlocked">
        <div className="bar-fill h-full bg-accent" style={{ width: `${(got / ACHIEVEMENTS.length) * 100}%` }} />
      </div>

      <Section title="Badges">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const at = p.unlocked[a.id];
            const prog = a.progress?.(p);
            return (
              <li
                key={a.id}
                tabIndex={0}
                aria-label={`${a.title}: ${a.desc} ${at ? "Unlocked." : "Locked."}`}
                className={`flex items-start gap-4 rounded-xl border p-4 ${at ? "border-accent/60 bg-accent/10" : "border-line bg-surface"}`}
              >
                <span className={`grid size-12 shrink-0 place-items-center rounded-full ${at ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"}`}>
                  <Icon name={at ? a.icon : "shield"} className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-display text-lg font-extrabold ${at ? "" : "text-fg/80"}`}>{a.title}</span>
                  <span className="block text-sm text-muted">{a.desc}</span>
                  {at ? (
                    <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-accent-text">
                      Unlocked {new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : prog ? (
                    <span className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full bg-accent/70" style={{ width: `${Math.min(100, (prog[0] / prog[1]) * 100)}%` }} />
                      </span>
                      <span className="tabular-nums">
                        {prog[0].toLocaleString("en-US")} / {prog[1].toLocaleString("en-US")}
                      </span>
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Your best scores">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shelf.map((g) => {
            const best = bestScore(p.runs[g.meta!.slug]);
            const plays = p.plays[g.meta!.slug] ?? 0;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => navigate(`/game/${g.key}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-accent"
                >
                  <img src={localize(g.meta!.cover)} alt="" className="aspect-video w-20 shrink-0 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{g.meta!.name}</span>
                    <span className="block text-sm text-muted">{plays === 1 ? "1 play" : `${plays} plays`}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs uppercase tracking-wide text-muted">Best</span>
                    <span className="block font-display text-lg font-extrabold tabular-nums text-accent-text">{best == null ? "—" : best.toLocaleString("en-US")}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
      <Footer />
    </Screen>
  );
}
