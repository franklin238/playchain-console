import { useEffect, useMemo, useRef, useState } from "react";
import { splitLocal } from "../arcade/logic";
import { hasVoting, refreshArcade, refreshBalance, useArcade, useEntry } from "../arcade/store";
import { refreshActivity } from "../arcade/activity";
import { consoleConfig } from "../config/console.config";
import { arcadeAbi } from "../config/contracts";
import { localize } from "../games/meta";
import { useAutoFocus, useBackHandler, useRestoreFocus } from "../input/hooks";
import { useSheets } from "../stores/sheets";
import { useUi } from "../stores/ui";
import { publicClient, txUrl } from "../web3/client";
import { formatWif, parseWif } from "../web3/tokens";
import { approveExact, sendVote } from "../web3/tx";
import { friendlyError, switchToRobinhood, useWallet, useWrongNetwork } from "../web3/wallet";
import { Button } from "./controls";
import { Icon } from "./Icon";
import { playSfx } from "../audio/engine";
import { saveVoteCard, shareOnXUrl } from "../lib/shareCard";
import { useProgress } from "../stores/progress";

type Phase = "input" | "approving" | "voting" | "done";

export function VoteSheet() {
  const key = useSheets((s) => s.voteKey);
  const close = useSheets((s) => s.closeVote);
  const openWallet = useSheets((s) => s.openWallet);
  const game = useEntry(key ?? undefined);
  const { mode, params, decimals, balance, race } = useArcade();
  const { status, address } = useWallet();
  const wrong = useWrongNetwork();
  const toast = useUi((s) => s.toast);

  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [approveTx, setApproveTx] = useState<string | null>(null);
  const [voteTx, setVoteTx] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ burned: bigint; toDev: bigint; toTreasury: bigint } | null>(null);
  // The vote just made, for the share card, and the game's place before it (for Kingmaker).
  const [lastVote, setLastVote] = useState<{ amount: bigint; burned: bigint; toDev: bigint } | null>(null);
  const rankBefore = useRef(0);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const open = !!key;
  useRestoreFocus(open);
  useAutoFocus(ref, [open]);
  const busy = phase === "approving" || phase === "voting";
  useBackHandler(() => !busy && close(), open, 50);

  // Reset every time the sheet opens for a game.
  useEffect(() => {
    if (!open) return;
    setPhase("input");
    setError(null);
    setApproveTx(null);
    setVoteTx(null);
    setText(params ? formatWif(params.minVote, decimals, 6).replace(/,/g, "") : "");
  }, [open, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = useMemo(() => parseWif(text, decimals), [text, decimals]);
  const selfVote = !!address && !!game?.developer && address.toLowerCase() === game.developer.toLowerCase();

  // Live split from the contract (previewSplit), with a local fallback while it loads.
  useEffect(() => {
    if (!open || !amount || !params || game?.id == null) {
      setPreview(null);
      return;
    }
    setPreview(splitLocal(amount, params.devBps, params.treasuryBps, selfVote));
    if (!consoleConfig.arcadeAddress) return;
    const voter = (address ?? "0x0000000000000000000000000000000000000001") as `0x${string}`;
    const t = window.setTimeout(() => {
      publicClient()
        .readContract({
          address: consoleConfig.arcadeAddress as `0x${string}`,
          abi: arcadeAbi,
          functionName: "previewSplit",
          args: [voter, BigInt(game.id!), amount],
        })
        .then(([burned, toDev, toTreasury]) => setPreview({ burned, toDev, toTreasury }))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, amount, params, game?.id, address, selfVote]);

  // Kingmaker: this vote moved the game into first place for the day.
  const leaderId = race[0]?.id;
  useEffect(() => {
    if (phase === "done" && game?.id != null && leaderId === game.id && rankBefore.current !== 1) useProgress.getState().recordKingmaker();
  }, [phase, leaderId, game?.id]);

  if (!open || !game?.meta) return null;
  const m = game.meta;

  const belowMin = !!amount && !!params && amount < params.minVote;
  const tooMuch = !!amount && balance != null && amount > balance;
  const rank = race.findIndex((r) => r.id === game.id) + 1;

  async function submit() {
    if (!amount || game?.id == null) return;
    setError(null);
    rankBefore.current = rank;
    try {
      setPhase("approving");
      const a = await approveExact(amount, (h) => setApproveTx(h));
      if (a) setApproveTx(a);
      setPhase("voting");
      const v = await sendVote(BigInt(game.id), amount, (h) => setVoteTx(h));
      setVoteTx(v);
      const split = preview ?? splitLocal(amount, params?.devBps ?? 4000, params?.treasuryBps ?? 2500, selfVote);
      setLastVote({ amount, burned: split.burned, toDev: split.toDev });
      setPhase("done");
      toast({ title: `Voted ${formatWif(amount, decimals)} WIF for ${m.name}`, tone: "success" });
      useProgress.getState().recordVote(Number(amount / 10n ** BigInt(Math.max(0, decimals - 2))) / 100);
      window.setTimeout(() => playSfx("burn"), 450);
      void refreshArcade();
      void refreshBalance();
      void refreshActivity();
    } catch (err) {
      setError(friendlyError(err));
      setPhase("input");
    }
  }

  const quick = params
    ? [
        { label: "Min", v: params.minVote },
        { label: "2x", v: params.minVote * 2n },
        { label: "5x", v: params.minVote * 5n },
      ]
    : [];

  let blocker: React.ReactNode = null;
  if (!hasVoting(mode) || game.id == null) blocker = <p className="text-muted">Voting opens once this game is listed onchain.</p>;
  else if (params?.paused) blocker = <p className="text-warn">Voting is paused right now.</p>;
  else if (status !== "connected")
    blocker = (
      <Button variant="primary" data-nav-default="" onClick={openWallet}>
        {mode === "demo" ? "Use the demo wallet to vote" : "Connect wallet to vote"}
      </Button>
    );
  else if (wrong)
    blocker = (
      <Button variant="primary" data-nav-default="" onClick={() => void switchToRobinhood()}>
        Switch to Robinhood Chain
      </Button>
    );
  else if (!game.active) blocker = <p className="text-warn">This game is hidden and can't take votes.</p>;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Vote for ${m.name}`}>
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-black/70" onClick={() => !busy && close()} />
      <div ref={ref} data-nav-scope="modal" className="fade-in relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-bg-2 sm:rounded-2xl">
        <div className="relative h-28 overflow-hidden">
          <img src={localize(m.cover)} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-2 to-transparent" />
          <button
            type="button"
            onClick={() => !busy && close()}
            aria-label="Close"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg bg-black/60 hover:bg-black/80"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="-mt-6 flex flex-col gap-4 p-6 pt-0">
          <div className="relative">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-muted">Vote with $WIF</div>
            <h2 className="font-display text-3xl font-extrabold">{m.name}</h2>
            {rank > 0 && <div className="text-sm text-accent-text">#{rank} in today's race</div>}
          </div>

          {phase === "done" ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-ok/50 bg-ok/10 p-4">
                <Icon name="check" className="size-7 text-ok" />
                <div>
                  <div className="font-bold">Vote confirmed</div>
                  <div className="text-sm text-muted">
                    {rank > 0 ? `${m.name} is #${rank} in today's Live Race.` : "The Live Race updates in a few seconds."}
                  </div>
                </div>
              </div>
              {voteTx && !txUrl(voteTx) && <span className="text-sm text-muted">Demo vote: it only exists in this browser.</span>}
              {voteTx && txUrl(voteTx) && (
                <a href={txUrl(voteTx)} target="_blank" rel="noreferrer" className="text-accent-text underline underline-offset-4">
                  View vote on Blockscout
                </a>
              )}
              {lastVote && params && (() => {
                const card = {
                  game: m.name,
                  cover: localize(m.cover),
                  amount: formatWif(lastVote.amount, decimals),
                  burned: `${formatWif(lastVote.burned, decimals)} WIF`,
                  toDev: `${formatWif(lastVote.toDev, decimals)} WIF`,
                  burnPct: params.burnBps / 100,
                  devPct: params.devBps / 100,
                  link: `${consoleConfig.siteOrigin}/game/${game.key}`,
                };
                return (
                  <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                    <div className="text-sm font-bold">Tell people about it</div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={shareOnXUrl(card)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => useProgress.getState().recordShare()}
                        className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 font-bold hover:border-accent hover:text-accent-text"
                      >
                        <Icon name="send" className="size-[1.1em]" /> Share on X
                      </a>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          const r = await saveVoteCard(card, `playchain-vote-${m.slug}.png`);
                          setSaving(false);
                          if (r === "failed") toast({ title: "Couldn't make the image", tone: "danger" });
                          else {
                            useProgress.getState().recordShare();
                            if (r === "saved") toast({ title: "Vote card saved", body: "Attach it to your post on X.", tone: "success" });
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 font-bold hover:border-accent hover:text-accent-text disabled:opacity-60"
                      >
                        <Icon name="image" className="size-[1.1em]" /> {saving ? "Making image…" : "Save image"}
                      </button>
                    </div>
                  </div>
                );
              })()}
              <Button variant="primary" data-nav-default="" onClick={close}>
                Done
              </Button>
            </div>
          ) : blocker ? (
            <div className="flex flex-col gap-3 py-2">{blocker}</div>
          ) : (
            <>
              <label className="flex flex-col gap-2">
                <span className="flex justify-between text-sm text-muted">
                  <span>Amount</span>
                  <span>Balance: {balance == null ? "…" : `${formatWif(balance, decimals)} WIF`}</span>
                </span>
                <div className="flex items-center rounded-xl border border-line-strong bg-surface focus-within:border-accent">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    inputMode="decimal"
                    disabled={busy}
                    data-nav-default=""
                    aria-label="Amount of WIF"
                    className="w-full bg-transparent px-4 py-3 font-display text-2xl font-extrabold tabular-nums outline-none"
                  />
                  <span className="pr-4 font-bold text-muted">WIF</span>
                </div>
              </label>
              <div className="flex gap-2">
                {quick.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={busy}
                    onClick={() => setText(formatWif(q.v, decimals, 6).replace(/,/g, ""))}
                    className="flex-1 rounded-lg border border-line-strong py-2 font-bold hover:border-accent"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {preview && amount && !belowMin && (
                <div className="grid gap-1.5 rounded-xl border border-line bg-surface p-4" aria-live="polite">
                  <SplitRow color="bg-accent-2" label="You burn" value={preview.burned} decimals={decimals} />
                  <SplitRow
                    color="bg-accent"
                    label={selfVote ? "Developer gets (self-vote: burned)" : "Developer gets"}
                    value={preview.toDev}
                    decimals={decimals}
                  />
                  <SplitRow color="bg-teal" label="Treasury gets" value={preview.toTreasury} decimals={decimals} />
                  <SplitBar parts={[preview.burned, preview.toDev, preview.toTreasury]} />
                </div>
              )}
              {belowMin && params && <p className="text-warn">The minimum vote is {formatWif(params.minVote, decimals)} WIF.</p>}
              {tooMuch && <p className="text-warn">Not enough $WIF in this wallet.</p>}

              <ol className="grid gap-2">
                <StepRow n={1} label="Approve this exact amount" state={phase === "approving" ? "active" : phase === "voting" ? "done" : "todo"} tx={approveTx} />
                <StepRow n={2} label="Vote" state={phase === "voting" ? "active" : "todo"} tx={phase === "voting" ? voteTx : null} />
              </ol>

              <Button variant="primary" size="lg" disabled={busy || !amount || belowMin || tooMuch} onClick={() => void submit()}>
                {phase === "approving" ? "Approving…" : phase === "voting" ? "Voting…" : "Approve and vote"}
              </Button>
            </>
          )}
          {error && (
            <p className="rounded-lg bg-danger/15 px-3 py-2 text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SplitRow({ color, label, value, decimals }: { color: string; label: string; value: bigint; decimals: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{formatWif(value, decimals, 4)} WIF</span>
    </div>
  );
}

export function SplitBar({ parts }: { parts: bigint[] }) {
  const total = parts.reduce((a, b) => a + b, 0n);
  if (total === 0n) return null;
  const colors = ["bg-accent-2", "bg-accent", "bg-teal"];
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10">
      {parts.map((p, i) => (
        <div key={i} className={colors[i]} style={{ width: `${Number((p * 10_000n) / total) / 100}%` }} />
      ))}
    </div>
  );
}

function StepRow({ n, label, state, tx }: { n: number; label: string; state: "todo" | "active" | "done"; tx: string | null }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        className={`grid size-7 place-items-center rounded-full font-bold ${
          state === "done" ? "bg-ok text-on-accent" : state === "active" ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"
        }`}
      >
        {state === "done" ? "✓" : n}
      </span>
      <span className={state === "todo" ? "text-muted" : ""}>
        {label}
        {state === "active" && " (confirm in your wallet)"}
      </span>
      {tx && txUrl(tx) && (
        <a href={txUrl(tx)} target="_blank" rel="noreferrer" className="ml-auto text-accent-text underline underline-offset-4">
          Blockscout
        </a>
      )}
    </li>
  );
}
