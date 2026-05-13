import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { usePlayerStore } from "@/application/stores/playerStore";
import { PlayIcon, PauseIcon, CloseIcon } from "@/presentation/components/ui/Icons";

const MINI_WIDTH = 180;
const MINI_HEIGHT = 101;
const EDGE_MARGIN = 8;
const BOTTOM_OFFSET = 60; // above bottom nav
const SWIPE_DISMISS_THRESHOLD = 120;

/**
 * YouTube-style floating mini-player. Shows a thumbnail video card
 * in the bottom-right corner when playback is minimized.
 * Supports drag repositioning and swipe-down to dismiss.
 */
export function MiniPlayer() {
  const status = usePlayerStore((s) => s.status);
  const url = usePlayerStore((s) => s.currentUrl);
  const title = usePlayerStore((s) => s.currentTitle);
  const isMinimized = usePlayerStore((s) => s.isMinimized);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const stop = usePlayerStore((s) => s.stop);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  if (status === "idle" || !url || !isMinimized) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const isPlaying = status === "playing" || status === "buffering";

  function handleTap() {
    if (!dragging) {
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          flushSync(() => usePlayerStore.getState().showOverlay());
        });
      } else {
        usePlayerStore.getState().showOverlay();
      }
    }
  }

  function handlePlayPause(event: React.MouseEvent | React.TouchEvent) {
    event.stopPropagation();
    if (isPlaying) {
      usePlayerStore.getState().pause();
    } else {
      usePlayerStore.getState().resume();
    }
  }

  function handleClose(event: React.MouseEvent | React.TouchEvent) {
    event.stopPropagation();
    stop();
  }

  function handleTouchStart(event: React.TouchEvent) {
    event.stopPropagation();
    event.preventDefault();
    const touch = event.touches[0]!;
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setDragging(false);
  }

  function handleTouchMove(event: React.TouchEvent) {
    event.stopPropagation();
    if (!touchStart.current) return;
    const touch = event.touches[0]!;
    const deltaY = touch.clientY - touchStart.current.y;

    if (Math.abs(deltaY) > 5) {
      setDragging(true);
    }

    // Only allow dragging downward for dismiss gesture
    if (deltaY > 0) {
      setOffsetY(deltaY);
    }
  }

  function handleTouchEnd() {
    if (offsetY > SWIPE_DISMISS_THRESHOLD) {
      // Dismiss with animation
      setDismissing(true);
      setTimeout(() => {
        stop();
        setDismissing(false);
        setOffsetY(0);
      }, 200);
    } else {
      setOffsetY(0);
      // If it was a tap (no drag, short time)
      if (!dragging && touchStart.current && Date.now() - touchStart.current.time < 200) {
        handleTap();
      }
    }
    touchStart.current = null;
    setTimeout(() => setDragging(false), 50);
  }

  const opacity = dismissing ? 0 : Math.max(0, 1 - offsetY / (SWIPE_DISMISS_THRESHOLD * 1.5));

  const miniPlayer = (
    <div
      ref={containerRef}
      data-morph-hero="true"
      className="fixed z-50 overflow-hidden rounded-lg shadow-2xl shadow-black/60"
      style={{
        viewTransitionName: "hero-thumbnail",
        width: MINI_WIDTH,
        height: MINI_HEIGHT,
        right: EDGE_MARGIN,
        bottom: BOTTOM_OFFSET,
        transform: `translateY(${offsetY}px)`,
        opacity,
        transition: dismissing ? "opacity 0.2s, transform 0.2s" : offsetY === 0 ? "transform 0.2s" : "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleTouchEnd(); }}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
    >
      {/* Dark overlay with controls */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handlePlayPause(e); }}
          className="rounded-full bg-black/50 p-1.5 text-white"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
        </button>

        {/* Close button - top right */}
        <button
          type="button"
          onClick={handleClose}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleClose(e); }}
          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
          aria-label="Close"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>

      {/* Title bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3">
        <p className="truncate text-[10px] font-medium leading-tight text-white">
          {title}
        </p>
      </div>

      {/* Progress bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20">
        <div
          className="h-full bg-[#f00]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  return createPortal(miniPlayer, document.body);
}
