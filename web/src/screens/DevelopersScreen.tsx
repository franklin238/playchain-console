import { useEffect, useState } from "react";
import { refreshArcade, refreshBalance, useArcade, type GameEntry, hasVoting } from "../arcade/store";
import { refreshActivity } from "../arcade/activity";
import { Button, Section } from "../components/controls";
import { Footer } from "../components/Footer";
import { GameTile } from "../components/GameTile";
import { Screen } from "../components/Screen";
import { consoleConfig } from "../config/console.config";
import { fetchMeta, isAllowedPlayUrl, localize, playOrigins, type MetaCheck } from "../games/meta";
import { useSheets } from "../stores/sheets";
import { useUi } from "../stores/ui";
import { txUrl } from "../web3/client";
import { formatWif } from "../web3/tokens";
import { approveExact, sendListGame, sendUpdateGame } from "../web3/tx";
import { friendlyError, switchToRobinhood, useWallet, useWrongNetwork } from "../web3/wallet";
import { useProgress } from "../stores/progress";

/** "https://my-site.com/games/x" -> "https://my-site.com", or null if it isn't a web address. */
function siteOf(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.includes(".") ? u.origin : null;
  } catch {
    return null;
  }
}

/** A ready-written post to the console owner on X, asking for a website to be approved. */
function approvalUrl(site: string, game?: string): string {
  const text = `@${consoleConfig.links.ownerX} Please approve my website for PlayChain so I can list ${game ? `"${game}"` : "my game"}: ${site}`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/** Developers ask the console owner to add their website to the play allowlist. */
function ApprovalRequest() {
  const [site, setSite] = useState("");
  const origin = siteOf(site);
  const approved = origin ? playOrigins().includes(origin) : false;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">
        To keep players safe, PlayChain only runs games from approved websites. Enter the website your game is hosted on and send the request. It
        opens a ready-written post to @{consoleConfig.links.ownerX} on X.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          // The phone keyboard's Go key sends the request, the same as the Ask on X button.
          enterKeyHint="go"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            e.currentTarget.blur();
            if (origin && !approved) window.open(approvalUrl(origin), "_blank", "noreferrer");
          }}
          placeholder="https://your-site.com"
          aria-label="Your game's website"
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-bg-2 px-4 py-2.5 font-mono text-sm outline-none focus:border-accent"
        />
        <a
          href={origin && !approved ? approvalUrl(origin) : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!origin || approved}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-bold uppercase tracking-wide ${
            origin && !approved ? "bg-accent text-on-accent hover:bg-accent-hover" : "pointer-events-none bg-surface-2 text-muted"
          }`}
        >
          Ask on X
        </a>
      </div>
      {site && !origin && <p className="text-sm text-warn">That doesn't look like a website address yet.</p>}
      {approved && <p className="text-sm text-ok">{origin} is already approved. You can list your game below.</p>}
    </div>
  );
}

const EXAMPLE = `{
  "name": "My Game",
  "slug": "my-game",
  "tagline": "One line that sells it.",
  "description": "Short paragraph, max 400 chars.",
  "genre": "Action",
  "developer": { "name": "You", "x": "yourhandle" },
  "cover": "https://your-site/games/my-game/cover.png",
  "playUrl": "https://your-site/games/my-game/index.html",
  "controls": "Arrows to move, Space to jump",
  "version": "1.0.0"
}`;

function useMetaPreview(uri: string): MetaCheck | null {
  const [check, setCheck] = useState<MetaCheck | null>(null);
  useEffect(() => {
    setCheck(null);
    const u = uri.trim();
    if (!u) return;
    if (!/^https:\/\//.test(u)) {
      setCheck({ ok: false, errors: ["Use an https:// URL."] });
      return;
    }
    if (new TextEncoder().encode(u).length > 256) {
      setCheck({ ok: false, errors: ["URL is longer than 256 bytes."] });
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      void fetchMeta(u).then((c) => live && setCheck(c));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [uri]);
  return check;
}

function previewEntry(check: MetaCheck | null): GameEntry | null {
  if (!check?.meta) return null;
  return {
    key: "preview",
    id: null,
    developer: null,
    active: true,
    listedAt: 0,
    totalVotes: 0n,
    epochVotes: 0n,
    uri: "",
    meta: check.meta,
    metaErrors: [],
  };
}

function ListForm() {
  const { params, decimals, balance, mode } = useArcade();
  const { status } = useWallet();
  const wrong = useWrongNetwork();
  const openWallet = useSheets((s) => s.openWallet);
  const toast = useUi((s) => s.toast);
  const [uri, setUri] = useState("");
  const check = useMetaPreview(uri);
  const [phase, setPhase] = useState<"idle" | "approving" | "listing" | "done">("idle");
  const [txs, setTxs] = useState<{ approve?: string; list?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const entry = previewEntry(check);
  const playOk = check?.meta ? isAllowedPlayUrl(localize(check.meta.playUrl)) : true;
  const busy = phase === "approving" || phase === "listing";

  async function submit() {
    if (!params) return;
    setError(null);
    setTxs({});
    try {
      setPhase("approving");
      const a = await approveExact(params.listingFee, (h) => setTxs((t) => ({ ...t, approve: h })));
      if (a) setTxs((t) => ({ ...t, approve: a }));
      setPhase("listing");
      const l = await sendListGame(uri.trim(), (h) => setTxs((t) => ({ ...t, list: h })));
      setTxs((t) => ({ ...t, list: l }));
      setPhase("done");
      toast({ title: "Game listed. Its fee is burned.", tone: "success" });
      useProgress.getState().recordListing();
      void refreshArcade();
      void refreshBalance();
      void refreshActivity();
    } catch (err) {
      setError(friendlyError(err));
      setPhase("idle");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-bold">Your meta.json URL</span>
          <input
            value={uri}
            onChange={(e) => {
              setUri(e.target.value);
              setPhase("idle");
            }}
            // Go closes the phone keyboard; the preview below updates as you type.
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="https://your-site/games/my-game/meta.json"
            disabled={busy}
            className="rounded-xl border border-line-strong bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        {check && !check.ok && (
          <ul className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            {check.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {check?.ok && !playOk && (
          <div className="flex flex-col gap-2 rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1">
              The playUrl's website isn't approved yet, so players won't be able to open it. Ask for it to be approved before listing.
            </span>
            <a
              href={approvalUrl(siteOf(check.meta!.playUrl) ?? check.meta!.playUrl, check.meta!.name)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 self-start rounded-lg border border-warn/60 px-3 py-1.5 font-bold text-warn hover:bg-warn/15"
            >
              Ask @{consoleConfig.links.ownerX} on X
            </a>
          </div>
        )}
        {!hasVoting(mode) ? (
          <p className="text-muted">Listing opens once the arcade contract is live.</p>
        ) : status !== "connected" ? (
          <Button variant="primary" className="self-start" onClick={openWallet}>
            Connect wallet to list
          </Button>
        ) : wrong ? (
          <Button variant="primary" className="self-start" onClick={() => void switchToRobinhood()}>
            Switch to {consoleConfig.networkName}
          </Button>
        ) : (
          <>
            {params && balance != null && balance < params.listingFee && (
              <p className="text-warn">You need {formatWif(params.listingFee, decimals)} WIF to list. This wallet has {formatWif(balance, decimals)}.</p>
            )}
            <Button
              variant="primary"
              size="lg"
              className="self-start"
              disabled={busy || !check?.ok || !playOk || !params || (balance != null && balance < params.listingFee)}
              onClick={() => void submit()}
            >
              {phase === "approving" ? "Approving…" : phase === "listing" ? "Listing…" : `Approve and list (burns ${params ? formatWif(params.listingFee, decimals) : "…"} WIF)`}
            </Button>
          </>
        )}
        {(txs.approve || txs.list) && (
          <div className="flex flex-wrap gap-4 text-sm">
            {txs.approve && txUrl(txs.approve) && (
              <a className="text-accent-text underline underline-offset-4" href={txUrl(txs.approve)} target="_blank" rel="noreferrer">
                Approval on Blockscout
              </a>
            )}
            {txs.list && txUrl(txs.list) && (
              <a className="text-accent-text underline underline-offset-4" href={txUrl(txs.list)} target="_blank" rel="noreferrer">
                Listing on Blockscout
              </a>
            )}
          </div>
        )}
        {phase === "done" && <p className="text-ok">Listed. It shows on the shelf within 15 seconds.</p>}
        {error && (
          <p className="rounded-lg bg-danger/15 px-3 py-2 text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
      <div>
        <div className="mb-2 text-sm text-muted">Tile preview</div>
        {entry ? (
          <GameTile game={entry} decimals={decimals} onSelect={() => {}} />
        ) : (
          <div className="grid aspect-video w-[17.5rem] place-items-center rounded-xl border border-dashed border-line-strong text-sm text-muted">
            Paste a URL to preview
          </div>
        )}
      </div>
    </div>
  );
}

function MyGames() {
  const { games, decimals } = useArcade();
  const { address } = useWallet();
  const toast = useUi((s) => s.toast);
  const [editing, setEditing] = useState<string | null>(null);
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useMetaPreview(editing ? uri : "");
  if (!address) return null;
  const mine = games.filter((g) => g.developer?.toLowerCase() === address.toLowerCase());
  if (!mine.length) return <p className="text-muted">No games listed from this wallet yet.</p>;

  async function save(g: GameEntry) {
    setBusy(true);
    setError(null);
    try {
      await sendUpdateGame(BigInt(g.id!), uri.trim());
      toast({ title: "Metadata updated", tone: "success" });
      setEditing(null);
      void refreshArcade();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {mine.map((g) => (
        <div key={g.key} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold">
                #{g.id} {g.meta?.name ?? "(metadata failed to load)"}
                {!g.active && <span className="ml-2 text-sm text-warn">hidden by moderator</span>}
              </div>
              <div className="text-sm text-muted">
                {formatWif(g.totalVotes, decimals)} WIF voted all time · you received 40% of votes from other wallets
              </div>
            </div>
            <Button
              onClick={() => {
                setEditing(editing === g.key ? null : g.key);
                setUri(g.uri);
              }}
            >
              {editing === g.key ? "Cancel" : "Edit URI"}
            </Button>
          </div>
          {editing === g.key && (
            <div className="mt-3 flex flex-col gap-2">
              <input
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className="rounded-xl border border-line-strong bg-bg-2 px-4 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
              {check && !check.ok && <p className="text-sm text-danger">{check.errors.join(" ")}</p>}
              <Button variant="primary" className="self-start" disabled={busy || !check?.ok} onClick={() => void save(g)}>
                {busy ? "Saving…" : "Save new URI"}
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          )}
          {g.metaErrors.length > 0 && <p className="mt-2 text-sm text-danger">Metadata problem: {g.metaErrors.join(" ")}</p>}
        </div>
      ))}
    </div>
  );
}

export default function DevelopersScreen() {
  const { params, decimals } = useArcade();
  const fee = params ? `${formatWif(params.listingFee, decimals)} WIF` : "100 WIF";
  const dev = params ? params.devBps / 100 : 40;
  return (
    <Screen title="List your game" subtitle={`Put your browser game on the PlayChain shelf and earn ${dev}% of every $WIF vote it gets.`}>
      <div className="grid max-w-5xl gap-2">
        <Section title="How it works">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Host your game", "Any HTML5 build that runs in a browser: canvas, Phaser, Godot or Unity WebGL. Add a meta.json next to it."],
              ["List it onchain", `One transaction burns the ${fee} listing fee and gives your game an id on ${consoleConfig.networkName}.`],
              ["Get paid per vote", `Players vote with $WIF. ${dev}% of each vote goes straight to your wallet in the same transaction.`],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-1 font-display text-2xl font-extrabold text-accent-text">{i + 1}</div>
                <div className="font-bold">{t}</div>
                <div className="mt-1 text-sm text-muted">{d}</div>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Get your website approved">
          <ApprovalRequest />
        </Section>
        <Section title="List a game">
          <ListForm />
        </Section>
        <Section title="Your games">
          <MyGames />
        </Section>
        <Section title="meta.json format">
          <pre className="overflow-x-auto rounded-xl border border-line bg-bg-2 p-4 text-sm">{EXAMPLE}</pre>
          <p className="text-sm text-muted">
            Cover and playUrl must be https. To keep players safe, games can only be played from approved domains: {playOrigins().join(", ")}
            {consoleConfig.extraPlayOrigins.length ? "" : " (more on request)"}. Games run in a sandboxed frame with no wallet access, and can talk to the console with
            postMessage: playchain:ready, playchain:score, playchain:exit, playchain:save and playchain:load.
          </p>
        </Section>
      </div>
      <Footer />
    </Screen>
  );
}
