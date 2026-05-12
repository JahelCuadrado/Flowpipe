import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { usePlayerStore } from "@/application/stores/playerStore";

/**
 * Handles deep linking from YouTube URLs.
 * When the app receives a URL like youtube.com/watch?v=XXX,
 * it redirects to the internal /watch route.
 *
 * Supports:
 * - youtube.com/watch?v=XXX
 * - youtu.be/XXX
 * - youtube.com/channel/XXX
 * - youtube.com/playlist?list=XXX
 * - youtube.com/@handle
 */
export function useDeepLinkHandler(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deepLink = params.get("deep_link");
    if (!deepLink) return;

    try {
      const url = new URL(deepLink);
      const hostname = url.hostname.replace("www.", "").replace("m.", "");

      if (hostname === "youtube.com" || hostname === "youtu.be") {
        // Watch page
        if (hostname === "youtu.be") {
          const videoId = url.pathname.slice(1);
          if (videoId) {
            usePlayerStore.getState().openVideo(`https://www.youtube.com/watch?v=${videoId}`);
            return;
          }
        }

        if (url.pathname === "/watch") {
          usePlayerStore.getState().openVideo(deepLink);
          return;
        }

        // Channel
        if (url.pathname.startsWith("/channel/") || url.pathname.startsWith("/@")) {
          navigate(`/channel?url=${encodeURIComponent(deepLink)}`);
          return;
        }

        // Playlist
        if (url.pathname === "/playlist") {
          navigate(`/playlist?url=${encodeURIComponent(deepLink)}`);
          return;
        }
      }
    } catch {
      // Invalid URL, ignore
    }
  }, [location.search, navigate]);
}
