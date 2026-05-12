import { create } from "zustand";
import { BackgroundPlayback } from "@/infrastructure/native/BackgroundPlayback";
import type { StreamInfoItem } from "@newpipe/shared";

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
  // ── Video overlay ──
  readonly overlayVideoUrl: string | null;
  readonly isOverlayVisible: boolean;
  readonly overlayPreloadData: StreamInfoItem | null;
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
  // ── Overlay ──
  openVideo(url: string, preloadData?: StreamInfoItem | null): void;
  minimizeOverlay(): void;
  showOverlay(): void;
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
  overlayVideoUrl: null,
  isOverlayVisible: false,
  overlayPreloadData: null,

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
      overlayVideoUrl: null,
      isOverlayVisible: false,
      overlayPreloadData: null,
    });
  },

  seek: (position) => set({ position }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setDuration: (duration) => set({ duration }),
  setPosition: (position) => set({ position }),
  setStatus: (status) => set({ status }),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),

  // ─── Overlay ─────────────────────────────────────────────────────
  openVideo: (url, preloadData = null) => {
    BackgroundPlayback.stop().catch(() => {});
    set({
      overlayVideoUrl: url,
      isOverlayVisible: true,
      isMinimized: false,
      overlayPreloadData: preloadData,
      status: "idle",
      duration: 0,
      position: 0,
    });
  },

  minimizeOverlay: () => set({
    isOverlayVisible: false,
    isMinimized: true,
  }),

  showOverlay: () => set({
    isOverlayVisible: true,
    isMinimized: false,
  }),
}));
