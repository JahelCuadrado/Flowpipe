import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { MiniPlayer } from "@/presentation/components/player/MiniPlayer";
import { useDeepLinkHandler } from "@/application/hooks/useDeepLinkHandler";
import { useBackButton } from "@/application/hooks/useBackButton";

interface AppShellProps {
  readonly children: ReactNode;
}

/**
  * Root layout shell containing the main content area, mini-player and bottom navigation.
  * Handles safe area insets for mobile devices with notches.
  */
export function AppShell({ children }: AppShellProps) {
  useDeepLinkHandler();
  useBackButton();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-background)]">
      {/* Main content — scrollable area above bottom nav */}
      <main className="safe-area-top flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* Mini player above bottom nav */}
      <MiniPlayer />

      {/* Fixed bottom navigation */}
      <BottomNav />
    </div>
  );
}
