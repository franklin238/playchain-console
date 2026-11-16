import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { startArcadePolling } from "./arcade/store";
import { AfterPlayPrompt } from "./components/AfterPlayPrompt";
import { BootScreen } from "./components/BootScreen";
import { GuideMenu, HintBar, Toasts } from "./components/Overlays";
import { TopBar } from "./components/TopBar";
import { VoteSheet } from "./components/VoteSheet";
import { WalletSheet } from "./components/WalletSheet";
import { InputProvider } from "./input/InputProvider";
import HomeScreen from "./screens/HomeScreen";
import { prefersReducedMotion, useSettings } from "./stores/settings";
import { useSheets } from "./stores/sheets";
import { useWallpaper } from "./stores/wallpaper";
import { Wallpaper } from "./wallpapers/Wallpaper";
import { restoreWallet } from "./web3/wallet";
import { duckMusic, playSfx } from "./audio/engine";
import { FullscreenControl } from "./components/FullscreenControl";
import { applyTheme } from "./theme/themes";
import { startAnalytics } from "./lib/analytics";
import { watchStyleChanges } from "./stores/progress";

const GameScreen = lazy(() => import("./screens/GameScreen"));
const PlayerScreen = lazy(() => import("./screens/PlayerScreen"));
const DevelopersScreen = lazy(() => import("./screens/DevelopersScreen"));
const ActivityScreen = lazy(() => import("./screens/ActivityScreen"));
const AboutScreen = lazy(() => import("./screens/AboutScreen"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));
const ControllerTestScreen = lazy(() => import("./screens/ControllerTestScreen"));
const AchievementsScreen = lazy(() => import("./screens/AchievementsScreen"));

/** A page that throws shows a way out instead of a blank screen. */
class PageBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page grid min-h-[70vh] place-items-center pt-24 text-center">
        <div className="max-w-md">
          <h1 className="mb-2 font-display text-2xl font-extrabold">Something went wrong on this page</h1>
          <p className="mb-5 text-muted">Your games and votes are safe. Reload, or head back home.</p>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-accent px-5 py-2.5 font-bold text-on-accent">Reload</button>
            <a href="/" className="rounded-lg border border-line-strong px-5 py-2.5 font-bold">Go home</a>
          </div>
        </div>
      </main>
    );
  }
}

function useMotionPreference() {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.motion = prefersReducedMotion() ? "reduce" : "full";
    };
    apply();
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", apply);
    return () => mq?.removeEventListener?.("change", apply);
  }, [reduceMotion]);
}

const BOOT_KEY = "pcf.booted";

function useBoot(): [boolean, () => void] {
  const [booting, setBooting] = useState(() => {
    try {
      return !window.sessionStorage.getItem(BOOT_KEY);
    } catch {
      return true;
    }
  });
  const done = () => {
    try {
      window.sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      // ignore
    }
    setBooting(false);
  };
  return [booting, done];
}

function Shell() {
  const location = useLocation();
  const inPlayer = location.pathname.startsWith("/play/");
  const [booting, bootDone] = useBoot();
  useMotionPreference();
  const theme = useSettings((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    void useWallpaper.getState().load();
    void restoreWallet();
    watchStyleChanges();
    startAnalytics();
    return startArcadePolling();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Lobby music fades out while a game runs (games have their own); a whoosh on every page change.
  const firstPage = useState(() => ({ done: false }))[0];
  useEffect(() => {
    duckMusic(inPlayer);
    if (firstPage.done && !inPlayer) playSfx("page");
    firstPage.done = true;
  }, [location.pathname, inPlayer, firstPage]);

  // V opens the vote sheet for the focused game (shelf tile or game page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "v" && e.key !== "V") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const key = el?.closest<HTMLElement>("[data-game-key]")?.dataset.gameKey ?? location.pathname.match(/^\/game\/([^/]+)/)?.[1];
      if (key) useSheets.getState().openVote(decodeURIComponent(key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname]);

  return (
    <InputProvider>
      {!inPlayer && <Wallpaper />}
      {!inPlayer && <TopBar />}
      <PageBoundary resetKey={location.pathname}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/game/:key" element={<GameScreen />} />
          <Route path="/play/:key" element={<PlayerScreen />} />
          <Route path="/developers" element={<DevelopersScreen />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/about" element={<AboutScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/achievements" element={<AchievementsScreen />} />
          <Route path="/settings/controller" element={<ControllerTestScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </Suspense>
      </PageBoundary>
      {!inPlayer && <HintBar />}
      {!inPlayer && <AfterPlayPrompt />}
      <VoteSheet />
      <WalletSheet />
      <GuideMenu />
      <Toasts />
      <FullscreenControl hidden={inPlayer} />
      {booting && <BootScreen onDone={bootDone} />}
    </InputProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
