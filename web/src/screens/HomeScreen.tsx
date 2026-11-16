import { useEffect, useMemo, useRef, useState } from "react";
import { playSfx } from "../audio/engine";
import { useNavigate } from "react-router";
import { resetDemo } from "../arcade/demo";
import { hasVoting, refreshArcade, shelfGames, useArcade, type GameEntry } from "../arcade/store";
import { refreshActivity } from "../arcade/activity";
import { BurnCounter } from "../components/BurnCounter";
import { Button } from "../components/controls";
import { Footer } from "../components/Footer";
import { enterGameFullscreen } from "../components/FullscreenControl";
import { GameTile } from "../components/GameTile";
import { Icon } from "../components/Icon";
import { EpochCountdown } from "../components/TopBar";
import { localize } from "../games/meta";
import { useAutoFocus } from "../input/hooks";
import { useSheets } from "../stores/sheets";
import { useWallpaper } from "../stores/wallpaper";
import { formatWif, formatWifShort } from "../web3/tokens";
import { readJson, writeJson } from "../lib/storage";
import { ACHIEVEMENTS, useProgress } from "../stores/progress";

/** The Spotlight game this browser last showed ("demo:3"), so a change can be celebrated once. */
const SEEN_KEY = "pc.seenSpotlight";

function SpotlightHero({ game, epoch, votes, takeover }: { game: GameEntry; epoch: bigint | null; votes: bigint; takeover: boolean }) {
  const navigate = useNavigate();
  const openVote = useSheets((s) => s.openVote);
  const decimals = useArcade((s) => s.decimals);
  const mode = useArcade((s) => s.mode);
  const current = useArcade((s) => s.epoch);
  const m = game.meta!;
  const today = epoch != null && epoch === current;
  const label = !hasVoting(mode)
    ? "Featured"
    : epoch == null
      ? "Newest game"
      : today
        ? "Spotlight · leading today"
        : epoch === current - 1n
          ? "Spotlight · yesterday's winner"
          : `Spotlight · winner of day ${(epoch + 1n).toString()}`;
  const src = localize(m.cover);

  return (
    <section
      aria-label="Spotlight"
      className={`relative mb-6 flex min-h-[23rem] items-end sm:mb-8 overflow-hidden rounded-2xl border border-line bg-black sm:h-[clamp(24rem,46vh,31rem)] ${takeover ? "spotlight-takeover" : ""}`}
    >
      <div key={`art-${game.key}`} aria-hidden="true" className="hero-layer absolute inset-0 opacity-100">
        <img src={src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
        <img
          src={src}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover sm:left-auto sm:aspect-video sm:w-auto sm:max-w-none sm:[mask-image:linear-gradient(to_right,transparent,black_35%)]"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent sm:h-1/3 sm:from-black/70" />
      <div key={`text-${game.key}`} className="hero-text relative flex max-w-2xl flex-col gap-3 p-5 sm:gap-4 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-sm font-extrabold uppercase tracking-wide text-on-accent">
            <Icon name="trophy" className="size-[1.1em]" /> {label}
          </span>
          {takeover && (
            <span role="status" className="takeover-badge rounded-md bg-accent-2 px-2.5 py-1 text-sm font-extrabold uppercase tracking-wide text-black">
              New leader!
            </span>
          )}
          <span className="rounded-md bg-white/12 px-2.5 py-1 text-sm font-bold uppercase tracking-wide backdrop-blur">{m.genre}</span>
        </div>
        <h1 className="glow-text font-display text-[clamp(1.75rem,4.2vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">{m.name}</h1>
        <p className="line-clamp-2 text-base text-fg/85 sm:text-lg">{m.tagline}</p>
        <p className="text-sm text-muted">
          by {m.developer.name}
          {game.id != null && (
            <>
              {" · "}
              {epoch != null ? `${formatWif(votes, decimals)} WIF ${today ? "today" : "that day"} · ` : ""}
              {formatWif(game.totalVotes, decimals)} WIF all time
            </>
          )}
        </p>
        {hasVoting(mode) && (
          <p className="-mt-2 text-sm text-muted">
            {today ? "Out-vote it to take the Spotlight. " : "No votes yet today: the first one takes the Spotlight. "}
            <EpochCountdown label="Today's race ends in " />
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-3">
          <Button variant="primary" icon="play" data-nav-default="" onClick={() => { enterGameFullscreen(); navigate(`/play/${game.key}`); }}>
            Play
          </Button>
          <Button icon="trophy" onClick={() => openVote(game.key)}>
            Vote
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/game/${game.key}`)}>
            Game info
          </Button>
        </div>
      </div>
    </section>
  );
}

function LiveRace() {
  const { race, games, decimals, epochTotal, mode } = useArcade();
  const openVote = useSheets((s) => s.openVote);
  const top = race[0]?.votes ?? 0n;
  return (
    <section aria-label="Live Race" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">Live Race</h2>
        <EpochCountdown className="text-sm" />
      </div>
      <p className="mb-4 text-sm text-muted">
        The game with the most votes today holds the Spotlight.
        {hasVoting(mode) && epochTotal > 0n ? ` ${formatWifShort(epochTotal, decimals)} WIF voted today.` : ""}
      </p>
      {race.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-5 text-center text-muted">
          {hasVoting(mode) ? "No votes yet today. Yours puts a game in the Spotlight." : "The race starts when the arcade goes live onchain."}
        </div>
      ) : (
        <ol className="grid gap-2">
          {race.map((r, i) => {
            const g = games.find((x) => x.id === r.id);
            if (!g?.meta) return null;
            const pct = top > 0n ? Number((r.votes * 1000n) / top) / 10 : 0;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openVote(g.key)}
                  className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-line bg-bg-2 px-3 py-2.5 text-left hover:border-accent"
                  aria-label={`${g.meta.name}, rank ${i + 1}, ${formatWif(r.votes, decimals)} WIF. Vote`}
                >
                  <div className="bar-fill absolute inset-y-0 left-0 bg-accent/12" style={{ width: `${pct}%` }} />
                  <span className={`relative w-6 text-center font-display font-extrabold ${i === 0 ? "text-accent-text" : "text-muted"}`}>{i + 1}</span>
                  <img src={localize(g.meta.cover)} alt="" className="relative aspect-video w-16 rounded-md object-cover" />
                  <span className="relative min-w-0 flex-1 truncate font-bold">{g.meta.name}</span>
                  <span className="relative shrink-0 font-bold tabular-nums">{formatWifShort(r.votes, decimals)} WIF</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function HowItWorks() {
  const params = useArcade((s) => s.params);
  const burn = params ? params.burnBps / 100 : 35;
  const dev = params ? params.devBps / 100 : 40;
  const tre = params ? params.treasuryBps / 100 : 25;
  return (
    <section aria-label="How votes work" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <BurnCounter className="mb-4" />
      <h2 className="mb-3 font-display text-xl font-extrabold sm:text-2xl">Every vote does three things</h2>
      <div className="mb-4 flex h-3 overflow-hidden rounded-full">
        <div className="bg-accent-2" style={{ width: `${burn}%` }} />
        <div className="bg-accent" style={{ width: `${dev}%` }} />
        <div className="bg-teal" style={{ width: `${tre}%` }} />
      </div>
      <ul className="grid gap-2 text-sm">
        <li className="flex gap-2"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent-2" /><span><b>{burn}% burns</b> $WIF forever</span></li>
        <li className="flex gap-2"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" /><span><b>{dev}% pays the developer</b> of the game you vote for</span></li>
        <li className="flex gap-2"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-teal" /><span><b>{tre}% funds</b> the PlayChain treasury</span></li>
      </ul>
      <p className="mt-3 text-sm text-muted">Listing a game burns its whole fee. Developers voting for their own game burn their share too.</p>
    </section>
  );
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const got = useProgress((s) => ACHIEVEMENTS.filter((a) => s.unlocked[a.id]).length);
  const { games, spotlight, mode, decimals, error, race } = useArcade();
  const ref = useRef<HTMLElement>(null);
  useAutoFocus(ref, [mode, games.length > 0]);

  const shelf = useMemo(() => shelfGames(games).sort((a, b) => (b.totalVotes > a.totalVotes ? 1 : b.totalVotes < a.totalVotes ? -1 : 0)), [games]);
  // Shelf search, genre filter and sort. The hero always uses the full shelf.
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<"votes" | "new">("votes");
  const genres = useMemo(() => [...new Set(shelf.map((g) => g.meta!.genre))].sort(), [shelf]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = shelf.filter(
      (g) => (!genre || g.meta!.genre === genre) && (!q || `${g.meta!.name} ${g.meta!.tagline} ${g.meta!.developer.name}`.toLowerCase().includes(q)),
    );
    return sort === "new" ? [...list].sort((a, b) => b.listedAt - a.listedAt) : list;
  }, [shelf, query, genre, sort]);
  // The hero is always the Spotlight: the game with the most votes today (yesterday's winner
  // until anyone votes today). Hovering or focusing shelf tiles never changes it.
  const hero = games.find((g) => g.key === spotlight?.key && g.meta) ?? shelf[0];

  // Takeover: when a different game takes the Spotlight (votes, never hovering), celebrate it
  // once with a fanfare and a flash. That includes a change that happened while you were away,
  // even since your last visit, but not the very first Spotlight this browser ever sees.
  const [takeover, setTakeover] = useState(false);
  const spotKey = hasVoting(mode) && spotlight?.key && hero?.key === spotlight.key ? `${mode}:${spotlight.key}` : null;
  useEffect(() => {
    if (!spotKey) return;
    const seen = readJson<string | null>(SEEN_KEY, null);
    if (seen !== spotKey) writeJson(SEEN_KEY, spotKey);
    if (seen != null && seen !== spotKey && seen.split(":")[0] === spotKey.split(":")[0]) {
      setTakeover(true);
      playSfx("fanfare");
    }
  }, [spotKey]);
  useEffect(() => {
    if (!takeover) return;
    const t = window.setTimeout(() => setTakeover(false), 4000);
    return () => window.clearTimeout(t);
  }, [takeover]);

  useEffect(() => {
    document.title = "PlayChain · play games, vote with $WIF";
  }, []);
  const setArt = useWallpaper((s) => s.setArt);
  const heroCover = hero?.meta ? localize(hero.meta.cover) : null;
  useEffect(() => setArt(heroCover), [heroCover, setArt]);

  return (
    <main ref={ref} className="page pb-4 pt-24 sm:pt-36">
      {mode === "preview" && (
        <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          Preview: the arcade contract isn't live yet, so voting is off. Every game is playable.
        </div>
      )}
      {mode === "demo" && (
        <div className="mb-5 flex flex-col items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:gap-4 sm:text-sm">
          <span className="min-w-0 flex-1">
            <b>Demo mode.</b> The arcade contract isn't deployed yet, so everything here runs in your browser with test $WIF: connect the
            demo wallet, vote, and watch the burn, the developer payout and the Live Race update. Nothing touches a real wallet.
          </span>
          <button
            type="button"
            onClick={() => { resetDemo(); void refreshArcade(); void refreshActivity(); }}
            className="shrink-0 rounded-lg border border-line-strong px-3 py-1.5 font-bold hover:border-fg"
          >
            Reset demo
          </button>
        </div>
      )}
      {error && mode === "live" && (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          Couldn't refresh from Robinhood Chain ({error}). Showing the last data. Retrying every 15 seconds.
        </div>
      )}

      {/* Nothing focusable until data arrives, so autofocus lands on Play. */}
      {(mode === "loading" || !hero) && <div className="h-[46vh] animate-pulse rounded-2xl border border-line bg-surface" />}
      {mode !== "loading" && hero && (
        <SpotlightHero
          game={hero}
          epoch={spotlight?.key === hero.key ? spotlight.epoch : null}
          votes={spotlight?.votes ?? 0n}
          takeover={takeover}
        />
      )}

      {mode !== "loading" && hero && (
      <>
      <section aria-label="Games" className="mb-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-extrabold sm:text-2xl">Game shelf</h2>
            <button
              type="button"
              onClick={() => navigate("/achievements")}
              aria-label={`Achievements: ${got} of ${ACHIEVEMENTS.length} unlocked`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm font-bold tabular-nums hover:border-accent hover:text-accent-text sm:hidden"
            >
              <Icon name="trophy" className="size-[1.1em]" /> Achievements {got}/{ACHIEVEMENTS.length}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // The list filters as you type, so the keyboard's Search key just closes the keyboard.
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search games"
              aria-label="Search games"
              className="w-40 rounded-lg border border-line bg-bg-2 px-3 py-1.5 text-sm sm:w-52"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "votes" | "new")}
              aria-label="Sort games"
              className="rounded-lg border border-line bg-bg-2 px-2 py-1.5 text-sm"
            >
              <option value="votes">Most voted</option>
              <option value="new">Newest</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by genre">
          {[null, ...genres].map((gn) => (
            <button
              key={gn ?? "all"}
              type="button"
              aria-pressed={genre === gn}
              onClick={() => setGenre(gn)}
              className={`rounded-full border px-3 py-1 text-sm font-bold ${genre === gn ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-fg"}`}
            >
              {gn ?? `All (${shelf.length})`}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex flex-col gap-2.5 pb-6 pt-4 sm:-mx-2 sm:flex-row sm:gap-5 sm:overflow-x-auto sm:px-2">
          {visible.length === 0 && (
            <div className="flex w-full shrink-0 items-center justify-center rounded-xl border border-dashed border-line-strong p-6 text-center text-muted sm:w-[17.5rem]">
              No games match. Try another search or genre.
            </div>
          )}
          {visible.map((g, i) => (
            <GameTile
              key={g.key}
              game={g}
              decimals={decimals}
              eager={i < 5}
              badge={race[0]?.id != null && race[0].id === g.id ? "Leading today" : undefined}
              onSelect={() => navigate(`/game/${g.key}`)}
            />
          ))}
          <button
            type="button"
            onClick={() => navigate("/developers")}
            className="tile flex w-full shrink-0 flex-row items-center justify-start gap-3 rounded-xl border border-dashed border-line-strong p-3 text-left text-muted sm:w-[17.5rem] sm:flex-col sm:justify-center sm:gap-2 sm:p-6 sm:text-center"
          >
            <Icon name="plus" className="size-6 shrink-0 sm:size-8" />
            <span className="flex flex-col sm:items-center sm:gap-2">
              <span className="font-bold text-fg">List your game</span>
              <span className="text-xs sm:text-sm">Earn 40% of every vote it gets</span>
            </span>
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <LiveRace />
        <HowItWorks />
      </div>
      <Footer />
      </>
      )}
    </main>
  );
}
