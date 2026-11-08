import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { hasVoting, useArcade, useEntry } from "../arcade/store";
import { Button } from "../components/controls";
import { Footer } from "../components/Footer";
import { enterGameFullscreen } from "../components/FullscreenControl";
import { Screen } from "../components/Screen";
import { shortAddress } from "../components/TopBar";
import { localize } from "../games/meta";
import { useSheets } from "../stores/sheets";
import { addressUrl } from "../web3/client";
import { formatWif } from "../web3/tokens";

export default function GameScreen() {
  const { key } = useParams();
  const game = useEntry(key);
  const { mode, decimals, race, spotlight } = useArcade();
  const navigate = useNavigate();
  const openVote = useSheets((s) => s.openVote);
  const gameName = game?.meta?.name;
  useEffect(() => {
    if (gameName) document.title = `${gameName} · PlayChain Flat`;
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
          <h1 className="font-display text-[clamp(2rem,3vw,3.2rem)] font-extrabold leading-tight">{m.name}</h1>
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
            <div>
              <dt className="text-muted">Developer</dt>
              <dd className="font-bold">
                {m.developer.name}
                {m.developer.x && (
                  <a className="ml-1.5 font-normal text-accent-text" href={`https://x.com/${m.developer.x}`} target="_blank" rel="noreferrer">
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
      <section className="mt-8 max-w-3xl">
        <h2 className="mb-2 font-display text-xl font-extrabold">About this game</h2>
        <p className="text-fg/85">{m.description}</p>
        <p className="mt-3 text-sm text-muted">Version {m.version}. Runs in a sandbox with no access to your wallet.</p>
      </section>
      <Footer />
    </Screen>
  );
}
