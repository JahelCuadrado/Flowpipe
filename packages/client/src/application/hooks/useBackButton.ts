import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Intercepts the Android hardware/gesture back button.
 * - If there is navigation history → go back
 * - If already at root (/) → exit the app
 */
export function useBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
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
