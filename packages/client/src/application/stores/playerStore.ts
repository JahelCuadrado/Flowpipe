import { create } from "zustand";
import { BackgroundPlayback } from "@/infrastructure/native/BackgroundPlayback";

type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "buffering" | "error";

interface PlayerState {
  readonly status: PlayerStatus;
  readonly currentUrl: string | null;
  readonly currentTitle: string | null;
  readonly currentUploader: string | null;
  readonly currentThumbnail: string | null;
  readonly duration: number;
  readonly position: number;
  readonly volume: number;
  readonly isMuted: boolean;
  readonly isMinimized: boolean;
}

interface PlayerActions {
  play(url: string, title: string, uploader: string, thumbnail: string | null): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(position: number): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  setDuration(duration: number): void;
  setPosition(position: number): void;
  setStatus(status: PlayerStatus): void;
  toggleMinimized(): void;
}

/**
  * Global player state managed by Zustand.
  * Persists the mini-player state across route navigation.
  */
export const usePlayerStore = create<PlayerState & PlayerActions>()((set) => ({
  // ─── State ───────────────────────────────────────────────────────
  status: "idle",
  currentUrl: null,
  currentTitle: null,
  currentUploader: null,
  currentThumbnail: null,
  duration: 0,
  position: 0,
  volume: 1,
  isMuted: false,
  isMinimized: true,

  // ─── Actions ─────────────────────────────────────────────────────
  play: (url, title, uploader, thumbnail) => {
    BackgroundPlayback.start(title, uploader).catch(() => {});
    set({
      status: "loading",
      currentUrl: url,
      currentTitle: title,
      currentUploader: uploader,
      currentThumbnail: thumbnail,
      position: 0,
      isMinimized: false,
    });
  },

  pause: () => set({ status: "paused" }),
  resume: () => set({ status: "playing" }),
  stop: () => {
    BackgroundPlayback.stop().catch(() => {});
    set({
      status: "idle",
      currentUrl: null,
      currentTitle: null,
      currentUploader: null,
      currentThumbnail: null,
      duration: 0,
      position: 0,
    });
  },

  seek: (position) => set({ position }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setDuration: (duration) => set({ duration }),
  setPosition: (position) => set({ position }),
  setStatus: (status) => set({ status }),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
}));
