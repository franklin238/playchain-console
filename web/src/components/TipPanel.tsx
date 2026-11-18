import { useCallback, useEffect, useState } from "react";
import { consoleConfig } from "../config/console.config";
import { useSheets } from "../stores/sheets";
import { txUrl } from "../web3/client";
import { formatUsd, parseUsd, readTipInfo, sendTip, type TipInfo } from "../web3/tips";
import { friendlyError, switchToRobinhood, useWallet, useWrongNetwork } from "../web3/wallet";
import { Button } from "./controls";

const PRESETS = ["1", "5", "10"];

/** Tip a game's developer in Paxos USDG: stable dollars, straight to their wallet. */
export function TipPanel({ id, developerName }: { id: number; developerName: string }) {
  const { status } = useWallet();
  const wrong = useWrongNetwork();
  const openWallet = useSheets((s) => s.openWallet);
  const [info, setInfo] = useState<TipInfo | null>(null);
  const [text, setText] = useState("5");
  const [step, setStep] = useState<"idle" | "approving" | "tipping" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const load = useCallback(() => { readTipInfo(BigInt(id)).then(setInfo).catch(() => {}); }, [id]);
  useEffect(load, [load]);

  const amount = parseUsd(text);
  const tooSmall = amount != null && info != null && amount < info.minTip;
  const devPct = info ? 100 - info.treasuryBps / 100 : 90;
  const busy = step === "approving" || step === "tipping";

  const go = async () => {
    if (!amount) return;
    setMsg(null); setHash(null);
    try {
      const h = await sendTip(BigInt(id), amount, setStep);
      setHash(h); setStep("done"); setMsg(`Sent ${formatUsd(amount)} USDG. ${developerName} got ${devPct}% of it.`);
      load();
    } catch (err) {
      setStep("error"); setMsg(friendlyError(err));
    }
  };

  return (
    <section aria-label="Tip the developer in USDG" className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Tip in USDG</h2>
        <span className="text-sm text-muted">{info ? `${formatUsd(info.total)} USDG tipped` : "…"}</span>
      </div>
      <p className="mb-3 text-sm text-muted">
        Pay {developerName} in stable dollars with Paxos USDG: {devPct}% goes straight to their wallet, {100 - devPct}% to the PlayChain
        treasury. Tips don't change the $WIF Spotlight race.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setText(p)}
            className={`rounded-lg border px-3 py-1.5 font-bold ${text === p ? "border-accent bg-accent/15 text-accent-text" : "border-line-strong hover:border-fg"}`}>
            ${p}
          </button>
        ))}
        <label className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5">
          <span className="sr-only">Amount of USDG</span>
          <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" aria-label="Amount of USDG"
            className="w-20 bg-transparent font-bold tabular-nums outline-none" />
          <span className="text-sm text-muted">USDG</span>
        </label>
      </div>
      {status !== "connected" ? (
        <Button onClick={openWallet}>Connect wallet to tip</Button>
      ) : wrong ? (
        <Button variant="primary" onClick={() => void switchToRobinhood()}>Switch to {consoleConfig.networkName}</Button>
      ) : (
        <Button variant="primary" disabled={!amount || tooSmall || busy} onClick={() => void go()}>
          {step === "approving" ? "Approve in your wallet…" : step === "tipping" ? "Confirm the tip…" : `Tip ${amount ? formatUsd(amount) : "…"} USDG`}
        </Button>
      )}
      {tooSmall && info && <p className="mt-2 text-sm text-warn">The smallest tip is {formatUsd(info.minTip)} USDG.</p>}
      {msg && (
        <p className={`mt-2 text-sm ${step === "done" ? "text-accent-text" : "text-danger"}`} role="status">
          {msg}{" "}
          {hash && txUrl(hash) && <a className="underline" href={txUrl(hash)} target="_blank" rel="noreferrer">View transaction</a>}
        </p>
      )}
      {consoleConfig.testnet && (
        <p className="mt-3 text-xs text-muted">
          Testnet: get free test USDG from the <a className="underline" href={consoleConfig.usdgFaucet} target="_blank" rel="noreferrer">Paxos faucet</a> (pick Robinhood Chain Testnet).
        </p>
      )}
    </section>
  );
}
