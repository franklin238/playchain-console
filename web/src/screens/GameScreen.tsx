import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { hasVoting, useArcade, useEntry } from "../arcade/store";
import { Button } from "../components/controls";
import { Footer } from "../components/Footer";
import { enterGameFullscreen } from "../components/FullscreenControl";
import { Screen } from "../components/Screen";
import { shortAddress } from "../components/TopBar";
import { localize } from "../games/meta";
import { useProgress } from "../stores/progress";
import { useSheets } from "../stores/sheets";
import { addressUrl } from "../web3/client";
import { formatWif } from "../web3/tokens";

/** Your five best play sessions in this game, kept in this browser. */
function HighScores({ slug }: { slug: string }) {
  const runs = useProgress((s) => s.runs[slug]);
  const plays = useProgress((s) => s.plays[slug] ?? 0);
  const top = (runs ?? []).slice(0, 5);
  return (
    <section aria-label="Your high scores" className="min-w-0 rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Your high scores</h2>
        <span className="text-sm text-muted">{plays === 1 ? "1 play" : `${plays} plays`}</span>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted">
          {plays > 0 ? "This game hasn't reported a score yet. Scores appear here once it does." : "Play to set your first score. Your best runs show up here."}
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-1.5">
          {top.map((r, i) => (
            <li key={r.session} className="flex items-center gap-3 rounded-lg bg-bg-2 px-3 py-2 text-sm">
              <span className={`w-5 text-center font-display font-extrabold ${i === 0 ? "text-accent-text" : "text-muted"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold tabular-nums">{r.score.toLocaleString("en-US")}</span>
              <span className="shrink-0 text-muted">{new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-muted">Kept in this browser only.</p>
    </section>
  );
}

export default function GameScreen() {
  const { key } = useParams();
  const game = useEntry(key);
  const { mode, decimals, race, spotlight } = useArcade();
  const navigate = useNavigate();
  const openVote = useSheets((s) => s.openVote);
  const gameName = game?.meta?.name;
  useEffect(() => {
    if (gameName) document.title = `${gameName} · PlayChain`;
  }, [gameName]);

  if (!game?.meta) {
    return (
      <Screen title={mode === "loading" ? "Loading…" : "Game not found"}>
        {mode !== "loading" && <Button onClick={() => navigate("/")}>Back home</Button>}
      </Screen>
    );
  }
  const m = game.meta;
  const rank = race.findIndex((r) => r.id === game.id) + 1;

  return (
    <Screen crumbs={[{ label: "Home", to: "/" }, { label: m.name }]}>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          <img src={localize(m.cover)} alt={`${m.name} cover art`} className="aspect-video w-full object-cover" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-bold uppercase tracking-wide">{m.genre}</span>
            {spotlight?.key === game.key && hasVoting(mode) && (
              <span className="rounded-md bg-accent px-2.5 py-1 text-sm font-extrabold uppercase tracking-wide text-on-accent">Spotlight</span>
            )}
            {rank > 0 && <span className="rounded-md bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent-text">#{rank} today</span>}
          </div>
          <h1 className="font-display text-[clamp(1.6rem,3vw,3.2rem)] font-extrabold leading-tight">{m.name}</h1>
          <p className="text-lg text-fg/85">{m.tagline}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon="play" size="lg" data-nav-default="" onClick={() => { enterGameFullscreen(); navigate(`/play/${game.key}`); }}>
              Play
            </Button>
            <Button icon="trophy" size="lg" onClick={() => openVote(game.key)}>
              Vote with $WIF
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
            <div className="min-w-0">
              <dt className="text-muted">Developer</dt>
              <dd className="font-bold">
                {m.developer.name}
                {/* The handle gets its own line, so a long one never runs into the payout wallet beside it. */}
                {m.developer.x && (
                  <a className="block break-all font-normal text-accent-text" href={`https://x.com/${m.developer.x}`} target="_blank" rel="noreferrer">
                    @{m.developer.x}
                  </a>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Payout wallet</dt>
              <dd className="font-bold">
                {game.developer ? (
                  <a href={addressUrl(game.developer)} target="_blank" rel="noreferrer" className="hover:text-accent-text">
                    {shortAddress(game.developer)}
                  </a>
                ) : (
                  "Not listed yet"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Voted today</dt>
              <dd className="font-bold tabular-nums">{formatWif(game.epochVotes, decimals)} WIF</dd>
            </div>
            <div>
              <dt className="text-muted">Voted all time</dt>
              <dd className="font-bold tabular-nums">{formatWif(game.totalVotes, decimals)} WIF</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Controls</dt>
              <dd>{m.controls || "See the game's title screen"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0">
          <h2 className="mb-2 font-display text-xl font-extrabold">About this game</h2>
          <p className="text-fg/85">{m.description}</p>
          <p className="mt-3 text-sm text-muted">Version {m.version}. Runs in a sandbox with no access to your wallet.</p>
        </section>
        <HighScores slug={m.slug} />
      </div>
      <Footer />
    </Screen>
  );
}
