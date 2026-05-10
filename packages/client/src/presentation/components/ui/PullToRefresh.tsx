import { useState, useRef, useCallback, type ReactNode } from "react";

interface PullToRefreshProps {
  readonly onRefresh: () => Promise<void>;
  readonly children: ReactNode;
}

const THRESHOLD = 80;
const MAX_PULL = 120;
const SPINNER_SIZE = 24;

/**
 * YouTube-style pull-to-refresh wrapper.
 * Shows a circular spinner when pulling down from the top of the list.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || refreshing) return;

    // Only start if scrolled to top
    if (container.scrollTop <= 0) {
      startYRef.current = event.touches[0]!.clientY;
      pullingRef.current = true;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!pullingRef.current || refreshing) return;

    const delta = event.touches[0]!.clientY - startYRef.current;
    if (delta > 0) {
      // Resistance factor: diminishing pull
      const distance = Math.min(delta * 0.5, MAX_PULL);
      setPullDistance(distance);
    } else {
      pullingRef.current = false;
      setPullDistance(0);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = refreshing ? undefined : pullDistance * 3;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Spinner indicator */}
      <div
        className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 transition-opacity duration-200"
        style={{
          top: pullDistance - SPINNER_SIZE - 12,
          opacity: progress > 0.1 ? progress : 0,
        }}
      >
        <div
          className={refreshing ? "animate-spin" : ""}
          style={{ transform: refreshing ? undefined : `rotate(${rotation}deg)` }}
        >
          <svg width={SPINNER_SIZE} height={SPINNER_SIZE} viewBox="0 0 24 24">
            <circle
              cx={12}
              cy={12}
              r={10}
              fill="none"
              stroke="#aaa"
              strokeWidth={2.5}
              strokeDasharray={62.83}
              strokeDashoffset={62.83 * (1 - progress)}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullingRef.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
