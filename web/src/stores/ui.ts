import { create } from "zustand";
import { playSfx } from "../audio/engine";

export interface Notice {
  id: string;
  title: string;
  body?: string;
  time: number;
  read: boolean;
  tone?: "info" | "success" | "warning" | "danger";
}

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warning" | "danger" | "achievement";
}

interface UiState {
  guideOpen: boolean;
  notificationsOpen: boolean;
  notices: Notice[];
  toasts: Toast[];
  setGuideOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  notify: (n: Omit<Notice, "id" | "time" | "read">) => void;
  markAllRead: () => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useUi = create<UiState>()((set, get) => ({
  guideOpen: false,
  notificationsOpen: false,
  notices: [],
  toasts: [],
  setGuideOpen: (guideOpen) => set({ guideOpen, notificationsOpen: false }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen, guideOpen: false }),
  notify: (n) =>
    set({ notices: [{ ...n, id: nextId(), time: Date.now(), read: false }, ...get().notices].slice(0, 50) }),
  markAllRead: () => set({ notices: get().notices.map((n) => ({ ...n, read: true })) }),
  toast: (t) => {
    playSfx(t.tone === "achievement" ? "unlock" : t.tone === "success" ? "success" : t.tone === "danger" ? "error" : "toast");
    const id = nextId();
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    window.setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
