import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { resetDemo } from "../arcade/demo";
import { hasVoting, refreshArcade, shelfGames, useArcade, type GameEntry } from "../arcade/store";
import { refreshActivity } from "../arcade/activity";
import { BurnCounter } from "../components/BurnCounter";
import { playSfx } from "../audio/engine";
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

function SpotlightHero({
  game,
  covers,
  previewing,
  epoch,
  votes,
}: {
  game: GameEntry;
  /** Every shelf game, stacked and preloaded so a preview swap is instant. */
  covers: GameEntry[];
  /** True while the hero shows a hovered shelf game instead of the real Spotlight. */
  previewing: boolean;
  epoch: bigint | null;
  votes: bigint;
}) {
  const navigate = useNavigate();
  const openVote = useSheets((s) => s.openVote);
  const decimals = useArcade((s) => s.decimals);
  const mode = useArcade((s) => s.mode);
  const current = useArcade((s) => s.epoch);
  const m = game.meta!;
  const label = !hasVoting(mode)
    ? "Featured"
    : epoch == null
      ? "Newest game"
      : epoch === current - 1n
        ? "Spotlight · yesterday's winner"
        : `Spotlight · winner of day ${(epoch + 1n).toString()}`;
  const layers = covers.some((g) => g.key === game.key) ? covers : [...covers, game];

  return (
    <section
      aria-label={previewing ? `Preview: ${m.name}` : "Spotlight"}
      className="relative mb-8 flex h-[31rem] items-end overflow-hidden rounded-2xl border border-line bg-black sm:h-[clamp(24rem,46vh,31rem)]"
    >
      {layers.map((g) => {
        const on = g.key === game.key;
        const src = localize(g.meta!.cover);
        return (
          <div key={g.key} aria-hidden="true" className={`hero-layer absolute inset-0 ${on ? "opacity-100" : "opacity-0"}`}>
            <img src={src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
            <img
              src={src}
              alt=""
              fetchPriority={on ? "high" : "low"}
              className="absolute inset-0 size-full object-cover sm:left-auto sm:aspect-video sm:w-auto sm:max-w-none sm:[mask-image:linear-gradient(to_right,transparent,black_35%)]"
            />
          </div>
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent sm:h-1/3 sm:from-black/70" />
      <div key={game.key} className="hero-text relative flex max-w-2xl flex-col gap-4 p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          {previewing ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent px-2.5 py-1 text-sm font-extrabold uppercase tracking-wide text-accent-text">
              <Icon name="play" className="size-[0.9em]" /> Preview
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-sm font-extrabold uppercase tracking-wide text-on-accent">
              <Icon name="trophy" className="size-[1.1em]" /> {label}
            </span>
          )}
          <span className="rounded-md bg-white/12 px-2.5 py-1 text-sm font-bold uppercase tracking-wide backdrop-blur">{m.genre}</span>
        </div>
        <h1 className="glow-text font-display text-[clamp(2.2rem,4.2vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">{m.name}</h1>
        <p className="line-clamp-2 text-base text-fg/85 sm:text-lg">{m.tagline}</p>
        <p className="text-sm text-muted">
          by {m.developer.name}
          {game.id != null && (
            <>
              {" · "}
              {!previewing && epoch != null ? `${formatWif(votes, decimals)} WIF that day · ` : ""}
              {formatWif(game.totalVotes, decimals)} WIF all time
            </>
          )}
        </p>
        {!previewing && <EpochCountdown className="-mt-2 text-sm" label="Next Spotlight in " />}
        <div className="mt-1 flex flex-wrap gap-3">
          <Button variant="primary" icon="play" data-nav-default={previewing ? undefined : ""} onClick={() => { enterGameFullscreen(); navigate(`/play/${game.key}`); }}>
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
        Today's most-voted game becomes tomorrow's Spotlight.
        {hasVoting(mode) && epochTotal > 0n ? ` ${formatWifShort(epochTotal, decimals)} WIF voted today.` : ""}
      </p>
      {race.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-5 text-center text-muted">
          {hasVoting(mode) ? "No votes yet today. Yours could decide tomorrow's Spotlight." : "The race starts when the arcade goes live onchain."}
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
  const burn = params ? params.burnBps / 100 : 50;
  const dev = params ? params.devBps / 100 : 40;
  const tre = params ? params.treasuryBps / 100 : 10;
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

/** The game last touched on the shelf, kept for the session so coming back home shows it again. */
let lastPreviewKey: string | null = null;

export default function HomeScreen() {
  const navigate = useNavigate();
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
  const hero = games.find((g) => g.key === spotlight?.key && g.meta) ?? shelf[0];

  // Hovering, focusing or touching a shelf tile puts that game in the hero, and it
  // stays there until another tile is touched. The real Spotlight stays in `hero`.
  const [previewKey, setPreviewKey] = useState<string | null>(lastPreviewKey);
  const preview = useCallback((key: string) => {
    if (key !== lastPreviewKey) playSfx("swap");
    lastPreviewKey = key;
    setPreviewKey(key);
  }, []);
  const previewGame = previewKey ? shelf.find((g) => g.key === previewKey) : undefined;
  const shown = previewGame ?? hero;
  const previewing = !!previewGame && previewGame.key !== hero?.key;

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
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
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
      {mode !== "loading" && hero && shown && (
        <SpotlightHero
          game={shown}
          covers={shelf}
          previewing={previewing}
          epoch={spotlight?.key === hero.key ? spotlight.epoch : null}
          votes={spotlight?.votes ?? 0n}
        />
      )}

      {mode !== "loading" && hero && (
      <>
      <section aria-label="Games" className="mb-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold sm:text-2xl">Game shelf</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
        <div className="no-scrollbar -mx-2 flex gap-4 overflow-x-auto px-2 pb-6 pt-4 sm:gap-5">
          {visible.length === 0 && (
            <div className="flex w-[15rem] shrink-0 items-center justify-center rounded-xl border border-dashed border-line-strong p-6 text-center text-muted sm:w-[17.5rem]">
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
              active={previewKey === g.key}
              onFocus={() => preview(g.key)}
              onTouchStart={() => preview(g.key)}
              onSelect={() => navigate(`/game/${g.key}`)}
            />
          ))}
          <button
            type="button"
            onClick={() => navigate("/developers")}
            className="tile flex w-[15rem] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-6 text-center text-muted sm:w-[17.5rem]"
          >
            <Icon name="plus" className="size-8" />
            <span className="font-bold text-fg">List your game</span>
            <span className="text-sm">Earn 40% of every vote it gets</span>
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
