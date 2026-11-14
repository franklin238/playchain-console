import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { countdown } from "../arcade/logic";
import { hasVoting, useArcade } from "../arcade/store";
import { useSheets } from "../stores/sheets";
import { useUi } from "../stores/ui";
import { formatWifShort } from "../web3/tokens";
import { switchToRobinhood, useWallet, useWrongNetwork } from "../web3/wallet";
import { toggleFullscreen, useIsFullscreen } from "./FullscreenControl";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function shortAddress(address: string, chars = 4): string {
  return address.length <= chars * 2 + 5 ? address : `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/** Time left in the current Spotlight epoch. */
export function EpochCountdown({ className = "", label = "Race ends " }: { className?: string; label?: string }) {
  const endsAt = useArcade((s) => s.epochEndsAt);
  const mode = useArcade((s) => s.mode);
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!hasVoting(mode) || !endsAt) return null;
  const left = endsAt - now;
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`} title="Time left in today's Spotlight race">
      <span className="text-muted">{label}</span>
      <span className="font-bold">{left > 0 ? countdown(left) : "now"}</span>
    </span>
  );
}

function WalletButton() {
  const { status, address } = useWallet();
  const wrong = useWrongNetwork();
  const balance = useArcade((s) => s.balance);
  const decimals = useArcade((s) => s.decimals);
  const openWallet = useSheets((s) => s.openWallet);

  if (status === "connected" && address) {
    if (wrong) {
      return (
        <button
          type="button"
          onClick={() => void switchToRobinhood()}
          className="whitespace-nowrap rounded-lg bg-warn px-4 py-2.5 font-bold text-on-accent"
        >
          Switch to Robinhood Chain
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={openWallet}
        aria-label={`Wallet ${address}`}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-line-strong px-2.5 py-2 font-semibold min-[400px]:gap-2.5 min-[400px]:px-3 sm:px-4"
      >
        {balance != null && (
          <span className="hidden tabular-nums text-accent-text sm:inline">{formatWifShort(balance, decimals)} WIF</span>
        )}
        <Icon name="wallet" className="size-[1.15em]" />
        <span className="hidden tabular-nums min-[400px]:inline">{shortAddress(address)}</span>
        <span className="tabular-nums min-[400px]:hidden">…{address.slice(-4)}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openWallet}
      aria-label="Connect wallet"
      className="whitespace-nowrap rounded-lg bg-accent px-3 py-2.5 font-bold uppercase min-[400px]:px-4 tracking-wide text-on-accent hover:bg-accent-hover sm:px-6 sm:py-3"
    >
      {status === "connecting" ? (
        "Connecting…"
      ) : (
        <>
          Connect<span className="hidden sm:inline"> wallet</span>
        </>
      )}
    </button>
  );
}

const TABS = [
  { to: "/", label: "Home", end: true },
  { to: "/developers", label: "Developers", end: false },
  { to: "/activity", label: "Activity", end: false },
  { to: "/about", label: "About", end: false },
  { to: "/settings", label: "Settings", end: false },
];

/** Press once for fullscreen, press again to go back to the window. */
function FullscreenButton() {
  const full = useIsFullscreen();
  if (typeof document !== "undefined" && !document.fullscreenEnabled) return null;
  const label = full ? "Exit fullscreen" : "Fullscreen";
  return (
    <button
      type="button"
      data-fs-toggle
      onClick={toggleFullscreen}
      aria-label={label}
      aria-pressed={full}
      title={label}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-fg hover:border-accent hover:text-accent-text"
    >
      <Icon name={full ? "shrink" : "expand"} />
    </button>
  );
}

export function TopBar() {
  const setGuideOpen = useUi((s) => s.setGuideOpen);
  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-bg via-bg/90 to-bg/70 px-2 pb-2 pt-2 backdrop-blur-md sm:px-[3vw] sm:pb-3 sm:pt-5">
      <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-2 rounded-2xl border border-line bg-bg-2/95 px-2.5 min-[400px]:gap-3 min-[400px]:px-3 shadow-[0_10px_40px_-20px_rgb(0_0_0/0.8)] backdrop-blur-md sm:h-[4.75rem] sm:gap-5 sm:px-6">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          aria-label="Open menu"
          title="Menu"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
        >
          <Icon name="menu" />
        </button>
        <Link to="/" className="shrink-0 rounded-md text-[1.05rem] leading-none sm:text-[1.35rem]" aria-label="PlayChain home">
          <Logo compact />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex xl:gap-3" aria-label="Main">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-2 font-bold uppercase tracking-wide transition-colors ${
                  isActive ? "text-accent-text" : "text-fg hover:text-accent-text"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-2">
          <EpochCountdown className="hidden text-sm md:inline" />
          <FullscreenButton />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
