import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { usePlayerStore } from "@/application/stores/playerStore";

/**
 * Intercepts the Android hardware/gesture back button.
 * - If the video overlay is open → minimize it
 * - If there is navigation history → go back
 * - If already at root (/) → exit the app
 */
export function useBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      // If in fullscreen, exit fullscreen first
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }

      // If video overlay is open, minimize it
      if (usePlayerStore.getState().isOverlayVisible) {
        usePlayerStore.getState().minimizeOverlay();
        return;
      }

      if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [navigate, location]);
}
