import { useEffect, useRef, useState } from "react";
import { useArcade } from "../arcade/store";
import { useAutoFocus, useBackHandler, useRestoreFocus } from "../input/hooks";
import { useSheets } from "../stores/sheets";
import { addressUrl, CHAIN } from "../web3/client";
import { formatWif } from "../web3/tokens";
import {
  connectWallet,
  disconnectWallet,
  listWallets,
  switchToRobinhood,
  useWallet,
  useWrongNetwork,
  watchWallets,
  type WalletOption,
} from "../web3/wallet";
import { Button } from "./controls";
import { Icon } from "./Icon";

export function WalletSheet() {
  const open = useSheets((s) => s.wallet);
  const close = useSheets((s) => s.closeWallet);
  const { status, address, walletName, error } = useWallet();
  const wrong = useWrongNetwork();
  const balance = useArcade((s) => s.balance);
  const decimals = useArcade((s) => s.decimals);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useRestoreFocus(open);
  useAutoFocus(ref, [open, status]);
  useBackHandler(close, open, 50);

  useEffect(() => {
    if (!open) return;
    setWallets(listWallets());
    return watchWallets(() => setWallets(listWallets()));
  }, [open]);

  if (!open) return null;
  const connected = status === "connected" && address;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Wallet">
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-black/70" onClick={close} />
      <div ref={ref} data-nav-scope="modal" className="fade-in relative w-full max-w-md rounded-t-2xl border border-line bg-bg-2 p-6 sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold">{connected ? "Your wallet" : "Connect a wallet"}</h2>
          <button type="button" onClick={close} aria-label="Close" className="grid size-10 place-items-center rounded-lg hover:bg-surface-2">
            <Icon name="x" />
          </button>
        </div>

        {connected ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-sm text-muted">{walletName ?? "Wallet"}</div>
              <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="break-all font-mono text-sm hover:text-accent-text">
                {address}
              </a>
              <div className="mt-3 text-sm text-muted">$WIF balance</div>
              <div className="font-display text-2xl font-extrabold text-accent-text">
                {balance == null ? "…" : `${formatWif(balance, decimals)} WIF`}
              </div>
            </div>
            {wrong && (
              <Button variant="primary" data-nav-default="" onClick={() => void switchToRobinhood()}>
                Switch to {CHAIN.name}
              </Button>
            )}
            <Button icon="logout" onClick={() => void disconnectWallet().then(close)}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="mb-2 text-muted">
              You can browse and play without a wallet. Connect one to vote with $WIF or list a game on {CHAIN.name}.
            </p>
            {wallets.length === 0 && (
              <div className="rounded-xl border border-line bg-surface p-4 text-muted">
                No browser wallet found. Install MetaMask or Rabby, then reload this page.
              </div>
            )}
            {wallets.map((w, i) => (
              <button
                key={w.id}
                type="button"
                data-nav-default={i === 0 ? "" : undefined}
                onClick={() => void connectWallet(w.id).then((ok) => ok && close())}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left font-bold hover:border-accent"
              >
                {w.icon ? <img src={w.icon} alt="" className="size-7 rounded" /> : <Icon name="wallet" />}
                {w.name}
                {status === "connecting" && <span className="ml-auto text-sm text-muted">Check your wallet…</span>}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-4 rounded-lg bg-danger/15 px-3 py-2 text-danger" role="alert">{error}</p>}
      </div>
    </div>
  );
}
