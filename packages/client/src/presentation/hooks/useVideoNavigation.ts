import { flushSync } from "react-dom";
import { usePlayerStore } from "@/application/stores/playerStore";
import type { StreamInfoItem } from "@newpipe/shared";

/**
 * Navigation state passed from video cards to the detail page.
 * Contains the data already available from the list item so the
 * detail page can render its skeleton instantly without waiting
 * for the full StreamInfo API call.
 */
export interface VideoNavigationState {
  readonly preloadData: StreamInfoItem;
}

// ─── Reverse transition coordination ────────────────────────────────────────
// Kept for backward compatibility with VideoCard components.
// With the overlay approach, reverse transition (player → card) is no longer
// used; minimize goes to mini-player instead.

let reverseTransitionUrl: string | null = null;

export function getReverseTransitionUrl(): string | null {
  return reverseTransitionUrl;
}

export function clearReverseTransitionUrl(): void {
  reverseTransitionUrl = null;
}

/**
 * Opens the video detail overlay using the View Transitions API
 * for a smooth thumbnail → player morph animation.
 *
 * Falls back to instant overlay when the API is unavailable.
 */
export function useVideoNavigation() {
  return (item: StreamInfoItem, thumbnailElement?: HTMLElement | null) => {
    if (!document.startViewTransition || !thumbnailElement) {
      usePlayerStore.getState().openVideo(item.url, item);
      return;
    }

    // Remove the transition name from any other element (e.g. MiniPlayer)
    // to avoid duplicate viewTransitionName which breaks the API silently.
    const existing = document.querySelector<HTMLElement>("[data-morph-hero]");
    if (existing && existing !== thumbnailElement) {
      existing.style.viewTransitionName = "";
    }

    // Promote to compositor layer before capturing snapshot
    thumbnailElement.style.willChange = "view-transition-name";
    thumbnailElement.style.viewTransitionName = "hero-thumbnail";

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        usePlayerStore.getState().openVideo(item.url, item);
      });
    });

    // Use .finally() to ensure cleanup even if the transition is skipped/cancelled
    transition.finished.finally(() => {
      thumbnailElement.style.viewTransitionName = "";
      thumbnailElement.style.willChange = "";
    });
  };
}
