import { useRef } from "react";
import { useNavigate } from "react-router";
import { useAutoFocus, useRestoreFocus } from "../input/hooks";
import { useSettings } from "../stores/settings";
import { useUi } from "../stores/ui";
import { Icon, type IconName } from "./Icon";

/** Start / menu button: the console's quick menu. */
export function GuideMenu() {
  const { guideOpen, setGuideOpen } = useUi();
  const navigate = useNavigate();
  const { muted, set } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  useRestoreFocus(guideOpen);
  useAutoFocus(ref, [guideOpen]);

  if (!guideOpen) return null;

  const go = (to: string) => {
    setGuideOpen(false);
    navigate(to);
  };

  const items: { icon: IconName; label: string; to: string }[] = [
    { icon: "home", label: "Home", to: "/" },
    { icon: "upload", label: "Developers", to: "/developers" },
    { icon: "clock", label: "Activity", to: "/activity" },
    { icon: "trophy", label: "Achievements", to: "/achievements" },
    { icon: "eye", label: "About", to: "/about" },
    { icon: "settings", label: "Settings", to: "/settings" },
  ];


  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu">
      <div
        ref={ref}
        data-nav-scope="modal"
        className="slide-in-left flex h-full w-full max-w-sm flex-col gap-1 overflow-y-auto border-r border-line bg-bg-2 px-4 pb-6 pt-8"
      >
        <div className="mb-5 px-3 text-sm font-bold uppercase tracking-[0.14em] text-muted">Menu</div>
        {items.map((item, i) => (
          <button
            key={item.to}
            type="button"
            data-nav-default={i === 0 ? "" : undefined}
            onClick={() => go(item.to)}
            className="flex items-center gap-3.5 rounded-lg px-3 py-3 text-left font-bold uppercase tracking-wide hover:bg-surface-2 hover:text-accent-text"
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
        <div className="my-3 h-px bg-line" />
        <button
          type="button"
          onClick={() => set({ muted: !muted })}
          className="flex items-center gap-3.5 rounded-lg px-3 py-3 text-left font-bold uppercase tracking-wide hover:bg-surface-2 hover:text-accent-text"
        >
          <Icon name={muted ? "musicOff" : "music"} />
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button
          type="button"
          onClick={() => setGuideOpen(false)}
          className="flex items-center gap-3.5 rounded-lg px-3 py-3 text-left font-bold uppercase tracking-wide hover:bg-surface-2 hover:text-accent-text"
        >
          <Icon name="x" />
          Close
        </button>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        className="flex-1 bg-black/60"
        onClick={() => setGuideOpen(false)}
      />
    </div>
  );
}

export function NotificationsPanel() {
  const { notificationsOpen, setNotificationsOpen, notices, markAllRead } = useUi();
  const ref = useRef<HTMLDivElement>(null);
  useRestoreFocus(notificationsOpen);
  useAutoFocus(ref, [notificationsOpen]);
  if (!notificationsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Notifications">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close notifications"
        className="flex-1 bg-black/60"
        onClick={() => setNotificationsOpen(false)}
      />
      <div
        ref={ref}
        data-nav-scope="modal"
        className="fade-in flex h-full w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-line bg-bg-2 px-5 pb-6 pt-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold">Notifications</h2>
          <button type="button" onClick={markAllRead} className="rounded-lg border-2 border-line-strong px-3 py-1.5 text-sm font-bold uppercase tracking-wide">
            Mark all read
          </button>
        </div>
        {notices.length === 0 && <p className="text-muted">Nothing new.</p>}
        {notices.map((n) => (
          <div
            key={n.id}
            tabIndex={0}
            className={`rounded-xl border px-4 py-3 ${n.read ? "border-line bg-surface" : "border-accent/60 bg-accent/10"}`}
          >
            <div className="font-bold">{n.title}</div>
            {n.body && <div className="mt-1 text-muted">{n.body}</div>}
            <div className="mt-1 text-sm text-muted">{new Date(n.time).toLocaleString()}</div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setNotificationsOpen(false)}
          className="mt-3 rounded-lg border-2 border-fg/85 px-5 py-2.5 font-bold uppercase tracking-wide"
        >
          Close
        </button>
      </div>
    </div>
  );
}

const TOAST_TONES = {
  info: "border-l-fg/40",
  success: "border-l-ok",
  warning: "border-l-warn",
  danger: "border-l-danger",
  achievement: "border-l-accent-2",
};

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`fade-in rounded-xl border border-line border-l-4 bg-bg-2 px-4 py-3 shadow-2xl ${TOAST_TONES[t.tone]}`}>
          <div className="flex items-center gap-2.5 font-bold">
            {t.tone === "achievement" && <Icon name="trophy" className="size-[1.3em] text-accent-2" />}
            {t.title}
          </div>
          {t.body && <div className="mt-1 text-muted">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}

function Key({ children }: { children: string }) {
  return (
    <span className="inline-grid min-w-7 place-items-center rounded-md border border-line-strong bg-surface-2 px-1.5 text-sm font-bold text-fg">
      {children}
    </span>
  );
}

/** Bottom-left controls hint. Shown for controller and keyboard, hidden for mouse. */
export function HintBar() {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-20 hidden max-w-[calc(100vw-2rem)] gap-6 rounded-lg border border-line bg-bg-2/90 px-4 py-2 text-sm text-muted backdrop-blur sm:left-[calc(3vw+1.5rem)] [html[data-input=gamepad]_&]:flex [html[data-input=keyboard]_&]:flex">
      <span className="hidden flex-wrap items-center gap-2 [html[data-input=gamepad]_&]:flex">
        <Key>A</Key> Select <Key>B</Key> Back <Key>☰</Key> Menu
      </span>
      <span className="hidden flex-wrap items-center gap-2 [html[data-input=keyboard]_&]:flex">
        <Key>Arrows</Key> Move <Key>Enter</Key> Open <Key>V</Key> Vote <Key>Esc</Key> Back
      </span>
    </div>
  );
}
