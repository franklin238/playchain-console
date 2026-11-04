import { useEffect } from "react";
import { refreshActivity, useActivity } from "../arcade/activity";
import { useArcade } from "../arcade/store";
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
    <Screen title="Activity" subtitle="Every vote and listing on PlayChainArcade, straight from Robinhood Chain.">
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="$WIF burned" value={formatWif(totals.burned, decimals, 0)} tone="text-accent-2" />
        <Stat label="Paid to developers" value={formatWif(totals.toDevs, decimals, 0)} tone="text-accent-text" />
        <Stat label="Votes" value={`${totals.votes} from ${totals.voters} wallets`} />
        <Stat label="Games listed" value={String(totals.listings)} />
      </div>
      {mode !== "live" && <p className="text-muted">The feed starts when the arcade contract is live.</p>}
      {error && <p className="mb-4 text-danger">Couldn't load all activity: {error}</p>}
      {mode === "live" && rows.length === 0 && <p className="text-muted">{loading ? "Reading events…" : "Nothing yet."}</p>}
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
              <span className="text-sm text-muted">block {r.block.toString()}</span>
            </a>
          </li>
        ))}
      </ol>
      <Footer />
    </Screen>
  );
}
