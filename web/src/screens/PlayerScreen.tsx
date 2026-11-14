import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useArcade, useEntry } from "../arcade/store";
import { Icon } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { shortAddress } from "../components/TopBar";
import { GAME_ALLOW, GAME_SANDBOX, loadGameSave, parseGameMessage, storeGameSave } from "../games/gameBridge";
import { isAllowedPlayUrl, localize } from "../games/meta";
import { useInputLayer } from "../input/hooks";
import { playSfx } from "../audio/engine";
import { enterFullscreen, leaveGameFullscreen } from "../components/FullscreenControl";
import { readJson, writeJson } from "../lib/storage";
import { useSettings } from "../stores/settings";
import { useSheets } from "../stores/sheets";
import { useUi } from "../stores/ui";
import { disconnectWallet, useWallet } from "../web3/wallet";

type Corner = "tl" | "tr" | "bl" | "br";
const CORNER_KEY = "pcf.playerMenuCorner";
const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];
const EDGE = 12;

/** Fixed position for the menu button in a corner, clear of the phone's notch and home bar. */
function cornerStyle(c: Corner): React.CSSProperties {
  const v = c[0] === "t" ? { top: `calc(env(safe-area-inset-top) + ${EDGE}px)` } : { bottom: `calc(env(safe-area-inset-bottom) + ${EDGE}px)` };
  const h = c[1] === "l" ? { left: `calc(env(safe-area-inset-left) + ${EDGE}px)` } : { right: `calc(env(safe-area-inset-right) + ${EDGE}px)` };
  return { ...v, ...h };
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[1.2em]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

function MenuItem({ icon, children, onClick, hint }: { icon: ReactNode; children: ReactNode; onClick: () => void; hint?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-semibold hover:bg-surface-2 focus:bg-surface-2"
    >
      <span className="grid size-6 shrink-0 place-items-center text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-sm text-muted">{hint}</span>}
    </button>
  );
}

/**
 * Full-screen game in a sandboxed iframe. The console adds one small floating
 * PlayChain button in a corner (draggable, remembered) and nothing else, so the
 * game is never covered. The button opens platform options; the game pauses
 * over postMessage while the menu or a sheet is open.
 */
export default function PlayerScreen() {
  const { key } = useParams();
  const game = useEntry(key);
  const mode = useArcade((s) => s.mode);
  const navigate = useNavigate();
  const { setAfterPlay, openVote, openWallet } = useSheets();
  const sheetOpen = useSheets((s) => s.wallet || s.voteKey != null);
  const toast = useUi((s) => s.toast);
  const { status: walletStatus, address } = useWallet();
  const muted = useSettings((s) => s.muted);
  const setSettings = useSettings((s) => s.set);

  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => playSfx("launch"), []);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setSlow(false);
    const t = window.setTimeout(() => setSlow(true), 12_000);
    return () => window.clearTimeout(t);
  }, [attempt]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [corner, setCorner] = useState<Corner>(() => {
    const c = readJson<Corner>(CORNER_KEY, "bl");
    return CORNERS.includes(c) ? c : "bl";
  });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = typeof document !== "undefined" && !!document.fullscreenEnabled;

  const playUrl = game?.meta ? localize(game.meta.playUrl) : null;
  const allowed = !!playUrl && isAllowedPlayUrl(playUrl);
  const slug = game?.meta?.slug ?? "";
  const paused = menuOpen || sheetOpen || leaveTo != null;

  const post = useCallback((msg: unknown) => {
    frame.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const leave = useCallback(
    (to: string) => {
      if (key) setAfterPlay(key);
      navigate(to);
    },
    [key, navigate, setAfterPlay],
  );

  // Bridge: only messages from this game's own frame, only known shapes.
  useEffect(() => {
    if (!allowed) return;
    function onMessage(e: MessageEvent) {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const msg = parseGameMessage(e.data);
      if (!msg) return;
      switch (msg.type) {
        case "playchain:ready":
          setReady(true);
          break;
        case "playchain:score":
          setScore(msg.score);
          break;
        case "playchain:exit":
          // The player chose Quit inside the game, so no confirmation here.
          leave(key ? `/game/${key}` : "/");
          break;
        case "playchain:save":
          storeGameSave(slug, msg.data);
          break;
        case "playchain:load":
          post({ type: "playchain:loaded", data: loadGameSave(slug) });
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [allowed, key, leave, post, slug]);

  // Pause while the menu, a confirmation or a sheet is open, or the tab is hidden.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    post({ type: paused ? "playchain:pause" : "playchain:resume" });
  }, [paused, post]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) post({ type: "playchain:pause" });
      else if (!pausedRef.current) post({ type: "playchain:resume" });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [post]);

  // Platform mute: tell the game now, and again once it says it is ready.
  useEffect(() => {
    post({ type: "playchain:mute", muted });
  }, [muted, ready, post]);

  // Games always play fullscreen. The Play button already asked for it; if the game opened another
  // way (a shared link) or the player pressed Esc, a button over the game brings fullscreen back.
  const [askFs, setAskFs] = useState(false);
  useEffect(() => {
    const onFs = () => {
      const full = !!document.fullscreenElement;
      setFullscreen(full);
      setAskFs(!full && canFullscreen);
    };
    document.addEventListener("fullscreenchange", onFs);
    if (!document.fullscreenElement && canFullscreen) {
      enterFullscreen();
      const t = window.setTimeout(() => { if (!document.fullscreenElement) setAskFs(true); }, 600);
      return () => { window.clearTimeout(t); document.removeEventListener("fullscreenchange", onFs); leaveGameFullscreen(); };
    }
    setFullscreen(!!document.fullscreenElement);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      leaveGameFullscreen();
    };
  }, [canFullscreen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    // Give the keyboard back to the game.
    requestAnimationFrame(() => frame.current?.focus());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("button")?.focus());
  }, [menuOpen]);

  // While a game runs, the controller belongs to the game. Back on the console
  // (when the console has focus) toggles the menu; open sheets handle their own Back.
  useInputLayer(
    (action) => {
      if (useSheets.getState().wallet || useSheets.getState().voteKey) return false;
      if (action === "back") {
        if (leaveTo) setLeaveTo(null);
        else if (menuOpen) closeMenu();
        else if (document.activeElement !== frame.current) setMenuOpen(true);
        return true;
      }
      return !menuOpen && !leaveTo;
    },
    90,
  );

  // Drag the button to another corner; a press without movement opens the menu.
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = dragStart.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10) return;
    s.moved = true;
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s) return;
    if (s.moved) {
      const c: Corner = `${e.clientY < window.innerHeight / 2 ? "t" : "b"}${e.clientX < window.innerWidth / 2 ? "l" : "r"}`;
      setCorner(c);
      writeJson(CORNER_KEY, c);
      setDrag(null);
    } else if (menuOpen) closeMenu();
    else setMenuOpen(true);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    // The whole document, not just the player, so the vote and wallet sheets still show.
    else void document.documentElement.requestFullscreen().catch(() => toast({ title: "Fullscreen isn't available here", tone: "warning" }));
  };

  const share = async () => {
    const url = `${window.location.origin}/game/${key}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", body: url, tone: "success" });
    } catch {
      toast({ title: "Copy this link", body: url, tone: "info" });
    }
  };

  if (!game) {
    if (mode === "loading") return <div className="fixed inset-0 grid place-items-center bg-black text-muted">Loading…</div>;
    return <Navigate to="/" replace />;
  }
  if (!game.meta || !allowed || !playUrl) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black p-6 text-center">
        <div className="max-w-md">
          <h1 className="mb-2 font-display text-2xl font-extrabold">This game can't be played here</h1>
          <p className="mb-5 text-muted">
            Its play URL isn't on PlayChain's allowlist yet. Developers can ask for their domain to be added on the Developers page.
          </p>
          <button type="button" onClick={() => navigate("/")} className="rounded-lg bg-accent px-5 py-2.5 font-bold text-on-accent">
            Back home
          </button>
        </div>
      </div>
    );
  }

  const m = game.meta;
  const top = corner[0] === "t";
  const left = corner[1] === "l";
  const buttonStyle: React.CSSProperties = drag ? { left: drag.x - 26, top: drag.y - 26 } : cornerStyle(corner);
  const menuStyle: React.CSSProperties = {
    ...(top
      ? { top: `calc(env(safe-area-inset-top) + ${EDGE + 62}px)` }
      : { bottom: `calc(env(safe-area-inset-bottom) + ${EDGE + 62}px)` }),
    ...(left ? { left: `calc(env(safe-area-inset-left) + ${EDGE}px)` } : { right: `calc(env(safe-area-inset-right) + ${EDGE}px)` }),
  };
  const go = (to: string) => {
    setMenuOpen(false);
    setLeaveTo(to);
  };

  return (
    <div ref={root} className="fixed inset-0 z-40 bg-black">
      <iframe
        ref={frame}
        src={playUrl}
        title={m.name}
        sandbox={GAME_SANDBOX}
        allow={GAME_ALLOW}
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full border-0"
        key={attempt}
        onLoad={() => frame.current?.focus()}
      />

      {slow && !ready && !menuOpen && !leaveTo && (
        <div className="absolute inset-x-0 top-3 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full border border-line bg-bg-2/90 px-4 py-2 text-sm backdrop-blur" role="status">
          <span>Still loading?</span>
          <button type="button" onClick={() => { setReady(false); setAttempt((a) => a + 1); }} className="font-bold text-accent-text">Retry</button>
          <button type="button" onClick={() => leave(key ? `/game/${key}` : "/")} className="font-bold text-muted hover:text-fg">Back</button>
        </div>
      )}
      {askFs && !menuOpen && !leaveTo && (
        <div className="absolute inset-x-0 top-3 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-accent/60 bg-bg-2/95 py-1.5 pl-2 pr-1.5 shadow-2xl backdrop-blur">
          <button
            type="button"
            data-fs-toggle
            onClick={() => {
              void document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => toast({ title: "Fullscreen isn't available here", tone: "warning" }));
              requestAnimationFrame(() => frame.current?.focus());
            }}
            className="flex min-h-[40px] items-center gap-2 rounded-full bg-accent px-4 font-bold text-on-accent hover:bg-accent-hover"
          >
            <FullscreenIcon exit={false} /> Play in fullscreen
          </button>
          <button type="button" onClick={() => { setAskFs(false); requestAnimationFrame(() => frame.current?.focus()); }} aria-label="Keep playing in a window" title="Keep playing in a window" className="grid size-10 place-items-center rounded-full text-muted hover:text-fg">
            <Icon name="x" className="size-5" />
          </button>
        </div>
      )}
      {(menuOpen || leaveTo) && (
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" onPointerDown={() => (leaveTo ? setLeaveTo(null) : closeMenu())} />
      )}

      <button
        type="button"
        aria-label={menuOpen ? "Close PlayChain menu" : "Open PlayChain menu"}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title="PlayChain menu (drag to move)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragStart.current = null;
          setDrag(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (menuOpen) closeMenu();
            else setMenuOpen(true);
          }
        }}
        style={buttonStyle}
        className={`absolute z-10 grid size-[52px] touch-none place-items-center rounded-full border border-accent/60 bg-black/70 shadow-lg backdrop-blur transition-opacity duration-200 hover:opacity-100 focus:opacity-100 ${
          menuOpen || drag ? "opacity-100" : "opacity-40"
        }`}
      >
        {menuOpen ? <Icon name="x" className="size-6 text-accent-text" /> : <LogoMark className="size-7" />}
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="PlayChain menu"
          style={menuStyle}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeMenu();
            }
          }}
          className="fade-in absolute z-10 flex max-h-[calc(100dvh-6rem)] w-[min(19rem,calc(100vw-1.5rem))] flex-col overflow-y-auto rounded-2xl border border-line bg-bg-2/95 p-2 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-2 px-3 pb-2 pt-1">
            <div className="min-w-0 flex-1">
              <div className="truncate font-display font-extrabold">{m.name}</div>
              <div className="text-sm text-muted">
                Paused{score != null && <> · Score <span className="tabular-nums text-accent-text">{score.toLocaleString("en-US")}</span></>}
              </div>
            </div>
            <button type="button" onClick={closeMenu} aria-label="Close menu" className="grid size-[44px] shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <Icon name="x" className="size-5" />
            </button>
          </div>
          <MenuItem icon={<Icon name="play" />} onClick={closeMenu}>
            Resume game
          </MenuItem>
          <MenuItem icon={<Icon name="trophy" />} onClick={() => key && openVote(key)}>
            Vote for this game
          </MenuItem>
          <div className="my-1 border-t border-line" />
          <MenuItem icon={<Icon name="home" />} onClick={() => go("/")}>
            Back to PlayChain
          </MenuItem>
          <MenuItem icon={<Icon name="gamepad" />} onClick={() => go(`/game/${key}`)}>
            Game info
          </MenuItem>
          <MenuItem icon={<Icon name="upload" />} onClick={() => go("/developers")}>
            Developers
          </MenuItem>
          <MenuItem icon={<Icon name="clock" />} onClick={() => go("/activity")}>
            Activity
          </MenuItem>
          <MenuItem icon={<Icon name="library" />} onClick={() => go("/about")}>
            About
          </MenuItem>
          <div className="my-1 border-t border-line" />
          {walletStatus === "connected" && address ? (
            <MenuItem icon={<Icon name="logout" />} onClick={() => void disconnectWallet()} hint={shortAddress(address)}>
              Disconnect wallet
            </MenuItem>
          ) : (
            <MenuItem icon={<Icon name="wallet" />} onClick={openWallet}>
              {walletStatus === "connecting" ? "Connecting…" : "Connect wallet"}
            </MenuItem>
          )}
          <MenuItem icon={<Icon name="link" />} onClick={() => void share()}>
            Share (copy link)
          </MenuItem>
          <MenuItem icon={<Icon name={muted ? "musicOff" : "music"} />} onClick={() => setSettings({ muted: !muted })} hint={muted ? "Off" : "On"}>
            Sound
          </MenuItem>
          {canFullscreen && (
            <MenuItem icon={<FullscreenIcon exit={fullscreen} />} onClick={toggleFullscreen}>
              {fullscreen ? "Exit fullscreen" : "Fullscreen"}
            </MenuItem>
          )}
          {!ready && <p className="px-3 pb-1 pt-2 text-sm text-muted">The game is still loading.</p>}
        </div>
      )}

      {leaveTo && (
        <div className="absolute inset-0 z-20 grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="fade-in w-full max-w-sm rounded-2xl border border-line bg-bg-2 p-6 shadow-2xl">
            <h2 id="leave-title" className="mb-1 font-display text-xl font-extrabold">
              Leave game?
            </h2>
            <p className="mb-5 text-muted">Progress in this run will be lost.</p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setLeaveTo(null);
                  requestAnimationFrame(() => frame.current?.focus());
                }}
                className="min-h-[44px] rounded-lg border border-line-strong px-4 font-bold hover:border-fg"
              >
                Keep playing
              </button>
              <button type="button" onClick={() => leave(leaveTo)} className="min-h-[44px] rounded-lg bg-accent px-4 font-bold text-on-accent hover:bg-accent-hover">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
