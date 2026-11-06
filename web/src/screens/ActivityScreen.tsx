import { useEffect } from "react";
import { refreshActivity, useActivity } from "../arcade/activity";
import { hasVoting, useArcade } from "../arcade/store";
import { useWallet } from "../web3/wallet";
import { Footer } from "../components/Footer";
import { Screen } from "../components/Screen";
import { shortAddress } from "../components/TopBar";
import { txUrl } from "../web3/client";
import { formatWif } from "../web3/tokens";

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className={`font-display text-2xl font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function ago(t: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function Board({ title, empty, rows }: { title: string; empty: string; rows: { k: string; label: React.ReactNode; value: string }[] }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 font-display text-lg font-extrabold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ol className="grid gap-1.5">
          {rows.map((r, i) => (
            <li key={r.k} className="flex items-center gap-3 rounded-lg bg-bg-2 px-3 py-2 text-sm">
              <span className={`w-5 text-center font-display font-extrabold ${i === 0 ? "text-accent-text" : "text-muted"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Leaderboards from the same events as the feed: games today, developers by earnings, voter streaks. */
function Leaderboards() {
  const { rows } = useActivity();
  const { games, race, decimals, epoch } = useArcade();
  const me = useWallet((s) => s.address)?.toLowerCase();
  const gameName = (id: number) => games.find((g) => g.id === id)?.meta?.name ?? `Game #${id}`;

  const today = race.slice(0, 5).map((r) => ({ k: String(r.id), label: <b>{gameName(r.id)}</b>, value: `${formatWif(r.votes, decimals, 0)} WIF` }));

  const earned = new Map<string, bigint>();
  for (const r of rows) if (r.kind === "vote") {
    const dev = games.find((g) => g.id === r.gameId)?.developer;
    if (dev) earned.set(dev.toLowerCase(), (earned.get(dev.toLowerCase()) ?? 0n) + r.toDev);
  }
  const devs = [...earned.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)).slice(0, 5).map(([addr, v]) => {
    const g = games.find((x) => x.developer?.toLowerCase() === addr);
    const titles = games.filter((x) => x.developer?.toLowerCase() === addr && x.meta).map((x) => x.meta!.name).join(", ");
    return { k: addr, label: <><b>{g?.meta?.developer.name ?? shortAddress(addr)}</b> <span className="text-muted">{titles}</span></>, value: `${formatWif(v, decimals, 0)} WIF` };
  });

  // Streak: consecutive days with at least one vote, ending today (or yesterday, if today's vote hasn't happened yet).
  const days = new Map<string, Set<bigint>>(), total = new Map<string, bigint>();
  for (const r of rows) if (r.kind === "vote") {
    const w = r.who.toLowerCase();
    (days.get(w) ?? days.set(w, new Set()).get(w)!).add(r.epoch);
    total.set(w, (total.get(w) ?? 0n) + r.amount);
  }
  const streakOf = (set: Set<bigint>) => {
    let e = set.has(epoch) ? epoch : epoch - 1n, n = 0;
    while (set.has(e)) { n++; e--; }
    return n;
  };
  const streaks = [...days.entries()].map(([w, set]) => ({ w, n: streakOf(set), t: total.get(w) ?? 0n }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n || (b.t > a.t ? 1 : -1)).slice(0, 5)
    .map((x) => ({ k: x.w, label: <><b className="tabular-nums">{shortAddress(x.w)}</b>{x.w === me ? <span className="ml-1.5 rounded bg-accent px-1.5 text-xs font-bold text-on-accent">YOU</span> : null} <span className="text-muted">{formatWif(x.t, decimals, 0)} WIF voted</span></>, value: `${x.n} day${x.n === 1 ? "" : "s"}` }));

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-3">
      <Board title="Top games today" empty="No votes yet today." rows={today} />
      <Board title="Top developers by earnings" empty="No developer earnings yet." rows={devs} />
      <Board title="Voting streaks" empty="Vote on two days in a row to start a streak." rows={streaks} />
    </div>
  );
}

export default function ActivityScreen() {
  const { rows, totals, loading, error } = useActivity();
  const { games, decimals, mode } = useArcade();

  useEffect(() => {
    void refreshActivity();
    const id = window.setInterval(() => void refreshActivity(), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const name = (id: number) => games.find((g) => g.id === id)?.meta?.name ?? `Game #${id}`;

  return (
    <Screen
      title="Activity"
      subtitle={mode === "demo" ? "Every vote and listing in the demo arcade. It runs in this browser with test $WIF until the contract is deployed." : "Every vote and listing on PlayChainArcade, straight from Robinhood Chain."}
    >
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="$WIF burned" value={formatWif(totals.burned, decimals, 0)} tone="text-accent-2" />
        <Stat label="Paid to developers" value={formatWif(totals.toDevs, decimals, 0)} tone="text-accent-text" />
        <Stat label="Votes" value={`${totals.votes} from ${totals.voters} wallets`} />
        <Stat label="Games listed" value={String(totals.listings)} />
      </div>
      {hasVoting(mode) && <Leaderboards />}
      {!hasVoting(mode) && <p className="text-muted">The feed starts when the arcade contract is live.</p>}
      {error && <p className="mb-4 text-danger">Couldn't load all activity: {error}</p>}
      {hasVoting(mode) && rows.length > 0 && <h2 className="mb-3 font-display text-xl font-extrabold">Live feed</h2>}
      {hasVoting(mode) && rows.length === 0 && <p className="text-muted">{loading ? "Reading events…" : "Nothing yet."}</p>}
      <ol className="grid gap-2">
        {rows.slice(0, 200).map((r) => (
          <li key={r.key}>
            <a
              href={txUrl(r.tx)}
              target="_blank"
              rel="noreferrer"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent"
            >
              {r.kind === "vote" ? (
                <>
                  <span className="rounded bg-accent/15 px-2 py-0.5 text-sm font-bold text-accent-text">Vote</span>
                  <span className="min-w-0 flex-1">
                    <b className="tabular-nums">{shortAddress(r.who)}</b> voted <b className="tabular-nums">{formatWif(r.amount, decimals)} WIF</b> for{" "}
                    <b>{name(r.gameId)}</b>
                  </span>
                  <span className="text-sm text-muted tabular-nums">
                    <span className="text-accent-2">{formatWif(r.burned, decimals)} burned</span> · {formatWif(r.toDev, decimals)} to dev ·{" "}
                    {formatWif(r.toTreasury, decimals)} treasury
                  </span>
                </>
              ) : (
                <>
                  <span className="rounded bg-accent-2/15 px-2 py-0.5 text-sm font-bold text-accent-2">Listing</span>
                  <span className="min-w-0 flex-1">
                    <b className="tabular-nums">{shortAddress(r.who)}</b> listed <b>{name(r.gameId)}</b>
                  </span>
                  <span className="text-sm text-accent-2 tabular-nums">{formatWif(r.burned, decimals)} WIF burned</span>
                </>
              )}
              <span className="text-sm text-muted">{r.time ? ago(r.time) : `block ${r.block.toString()}`}</span>
            </a>
          </li>
        ))}
      </ol>
      <Footer />
    </Screen>
  );
}
