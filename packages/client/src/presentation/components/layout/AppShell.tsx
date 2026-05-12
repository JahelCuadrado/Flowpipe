import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { MiniPlayer } from "@/presentation/components/player/MiniPlayer";
import { usePlayerStore } from "@/application/stores/playerStore";
import { useDeepLinkHandler } from "@/application/hooks/useDeepLinkHandler";
import { useBackButton } from "@/application/hooks/useBackButton";

const VideoDetailPage = lazy(() => import("@/presentation/pages/VideoDetailPage"));

interface AppShellProps {
  readonly children: ReactNode;
}

/**
  * Root layout shell containing the main content area, video overlay,
  * mini-player and bottom navigation.
  * Handles safe area insets for mobile devices with notches.
  */
export function AppShell({ children }: AppShellProps) {
  useDeepLinkHandler();
  useBackButton();

  const overlayUrl = usePlayerStore((s) => s.overlayVideoUrl);
  const isOverlayVisible = usePlayerStore((s) => s.isOverlayVisible);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-background)]">
      {/* Main content — scrollable area above bottom nav */}
      <main
        className="flex-1 overflow-y-auto pb-16"
        style={isOverlayVisible ? { overflow: "hidden" } : undefined}
      >
        {children}
      </main>

      {/* Video detail overlay — persists while a video is loaded */}
      {overlayUrl && (
        <div
          className={isOverlayVisible ? "fixed inset-0 z-40 overflow-y-auto bg-[#0f0f0f]" : "fixed z-40 overflow-hidden"}
          style={isOverlayVisible ? {
            pointerEvents: "auto",
          } : (() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const scale = 180 / vw;
            const videoH = vw * 9 / 16;
            return {
              top: 0,
              left: 0,
              width: vw,
              height: videoH,
              transformOrigin: "top left",
              transform: `translate(${vw - 8 - 180}px, ${vh - 60 - 101}px) scale(${scale})`,
              borderRadius: `${8 / scale}px`,
              pointerEvents: "none" as const,
            };
          })()}
        >
          <Suspense
            fallback={
              <div className="flex flex-col bg-[#0f0f0f]">
                <div
                  className="relative aspect-video w-full bg-black"
                  style={{ viewTransitionName: "hero-thumbnail" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/30 border-t-white" />
                  </div>
                </div>
              </div>
            }
          >
            <VideoDetailPage key={overlayUrl} />
          </Suspense>
        </div>
      )}

      {/* Mini player above bottom nav */}
      <MiniPlayer />

      {/* Fixed bottom navigation */}
      <BottomNav />
    </div>
  );
}
