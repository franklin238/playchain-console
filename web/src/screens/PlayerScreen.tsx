import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useArcade, useEntry } from "../arcade/store";
import { Icon } from "../components/Icon";
import { GAME_ALLOW, GAME_SANDBOX, loadGameSave, parseGameMessage, storeGameSave } from "../games/gameBridge";
import { isAllowedPlayUrl, localize } from "../games/meta";
import { useInputLayer } from "../input/hooks";
import { useSheets } from "../stores/sheets";

/** Full-screen game in a sandboxed iframe. Esc (when the console has focus) or the Back button returns. */
export default function PlayerScreen() {
  const { key } = useParams();
  const game = useEntry(key);
  const mode = useArcade((s) => s.mode);
  const navigate = useNavigate();
  const setAfterPlay = useSheets((s) => s.setAfterPlay);
  const frame = useRef<HTMLIFrameElement>(null);
  const [score, setScore] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [chrome, setChrome] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const playUrl = game?.meta ? localize(game.meta.playUrl) : null;
  const allowed = !!playUrl && isAllowedPlayUrl(playUrl);
  const slug = game?.meta?.slug ?? "";

  const post = useCallback((msg: unknown) => {
    frame.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const exit = useCallback(() => {
    if (key) setAfterPlay(key);
    navigate(key ? `/game/${key}` : "/");
  }, [key, navigate, setAfterPlay]);

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
          exit();
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
  }, [allowed, exit, post, slug]);

  // Pause the game when the tab is hidden.
  useEffect(() => {
    const onVis = () => post({ type: document.hidden ? "playchain:pause" : "playchain:resume" });
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [post]);

  // The overlay hides itself while playing and comes back on mouse movement.
  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 2500);
  }, []);
  useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [poke]);

  // While a game runs, the controller belongs to the game. Back on the console
  // only acts when the console itself has focus (for example after clicking the overlay).
  useInputLayer(
    (action) => {
      if (action === "back" && document.activeElement !== frame.current) {
        exit();
        return true;
      }
      return true;
    },
    90,
  );

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
            Its play URL isn't on PlayChain Flat's allowlist yet. Developers can ask for their domain to be added on the Developers page.
          </p>
          <button type="button" onClick={() => navigate("/")} className="rounded-lg bg-accent px-5 py-2.5 font-bold text-on-accent">
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black" onMouseMove={poke} onTouchStart={poke}>
      <iframe
        ref={frame}
        src={playUrl}
        title={game.meta.name}
        sandbox={GAME_SANDBOX}
        allow={GAME_ALLOW}
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full border-0"
        onLoad={() => frame.current?.focus()}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 transition-opacity duration-300 ${
          chrome || !ready ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={exit}
          className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 font-bold backdrop-blur hover:bg-black/90"
        >
          <Icon name="chevronLeft" className="size-[1.2em]" /> PlayChain
        </button>
        <div className="flex flex-col items-end gap-2">
          {score != null && (
            <div className="rounded-lg bg-black/70 px-3 py-2 font-bold tabular-nums backdrop-blur">
              Score <span className="text-accent-text">{score.toLocaleString("en-US")}</span>
            </div>
          )}
          <div className="hidden rounded-lg bg-black/60 px-3 py-1.5 text-sm text-muted backdrop-blur sm:block">
            Quit from the game's pause menu, or click PlayChain
          </div>
        </div>
      </div>
    </div>
  );
}
