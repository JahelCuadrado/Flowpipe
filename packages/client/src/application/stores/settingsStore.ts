import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface VisibleTabs {
  readonly home: boolean;
  readonly shorts: boolean;
  readonly subscriptions: boolean;
}

interface SettingsState {
  readonly theme: "dark" | "light" | "system";
  readonly defaultServiceId: number;
  readonly autoplay: boolean;
  readonly defaultResolution: string;
  readonly defaultAudioFormat: string;
  readonly showRelatedStreams: boolean;
  readonly showComments: boolean;
  readonly showSearchHistory: boolean;
  readonly showWatchHistory: boolean;
  readonly apiBaseUrl: string;
  readonly contentCountry: string;
  readonly visibleTabs: VisibleTabs;
}

interface SettingsActions {
  setTheme(theme: "dark" | "light" | "system"): void;
  setDefaultServiceId(serviceId: number): void;
  setAutoplay(autoplay: boolean): void;
  setDefaultResolution(resolution: string): void;
  setDefaultAudioFormat(format: string): void;
  setShowRelatedStreams(show: boolean): void;
  setShowComments(show: boolean): void;
  setShowSearchHistory(show: boolean): void;
  setShowWatchHistory(show: boolean): void;
  setApiBaseUrl(url: string): void;
  setContentCountry(country: string): void;
  setVisibleTab(tab: keyof VisibleTabs, visible: boolean): void;
}

/**
  * User settings persisted to localStorage.
  */
export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // ─── Defaults ──────────────────────────────────────────────────
      theme: "dark",
      defaultServiceId: 0,
      autoplay: false,
      defaultResolution: "720p",
      defaultAudioFormat: "m4a",
      showRelatedStreams: true,
      showComments: true,
      showSearchHistory: true,
      showWatchHistory: true,
      apiBaseUrl: "/api/v1",
      contentCountry: "ES",
      visibleTabs: { home: true, shorts: true, subscriptions: true },

      // ─── Actions ─────────────────────────────────────────────────
      setTheme: (theme) => set({ theme }),
      setDefaultServiceId: (defaultServiceId) => set({ defaultServiceId }),
      setAutoplay: (autoplay) => set({ autoplay }),
      setDefaultResolution: (defaultResolution) => set({ defaultResolution }),
      setDefaultAudioFormat: (defaultAudioFormat) => set({ defaultAudioFormat }),
      setShowRelatedStreams: (showRelatedStreams) => set({ showRelatedStreams }),
      setShowComments: (showComments) => set({ showComments }),
      setShowSearchHistory: (showSearchHistory) => set({ showSearchHistory }),
      setShowWatchHistory: (showWatchHistory) => set({ showWatchHistory }),
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setContentCountry: (contentCountry) => set({ contentCountry }),
      setVisibleTab: (tab, visible) => set((state) => ({
        visibleTabs: { ...state.visibleTabs, [tab]: visible },
      })),
    }),
    {
      name: "newpipe-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
