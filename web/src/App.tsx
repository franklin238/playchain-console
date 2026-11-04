import { lazy, Suspense, useEffect, useState } from "react";
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

const GameScreen = lazy(() => import("./screens/GameScreen"));
const PlayerScreen = lazy(() => import("./screens/PlayerScreen"));
const DevelopersScreen = lazy(() => import("./screens/DevelopersScreen"));
const ActivityScreen = lazy(() => import("./screens/ActivityScreen"));
const AboutScreen = lazy(() => import("./screens/AboutScreen"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));
const ControllerTestScreen = lazy(() => import("./screens/ControllerTestScreen"));

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

  useEffect(() => {
    void useWallpaper.getState().load();
    void restoreWallet();
    return startArcadePolling();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

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
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/game/:key" element={<GameScreen />} />
          <Route path="/play/:key" element={<PlayerScreen />} />
          <Route path="/developers" element={<DevelopersScreen />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/about" element={<AboutScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/controller" element={<ControllerTestScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </Suspense>
      {!inPlayer && <HintBar />}
      {!inPlayer && <AfterPlayPrompt />}
      <VoteSheet />
      <WalletSheet />
      <GuideMenu />
      <Toasts />
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
