import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  /** Whether the sheet is open */
  readonly isOpen: boolean;
  /** Called when the sheet should close (backdrop tap or swipe down) */
  readonly onClose: () => void;
  /** Sheet content */
  readonly children: ReactNode;
  /** Optional title for the drag handle header */
  readonly title?: string;
  /** Maximum height as percentage of viewport (0-100). Default 85 */
  readonly maxHeightPercent?: number;
  /** If true, sheet opens at half height first and can expand. Default false */
  readonly snapToHalf?: boolean;
}

const DRAG_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.5;
const ANIMATION_DURATION_MS = 300;

/**
 * YouTube-style bottom sheet with drag-to-dismiss.
 * Slides up from bottom with backdrop overlay.
 * Supports swipe-down to close with velocity detection.
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  maxHeightPercent = 85,
  snapToHalf = false,
}: BottomSheetProps) {
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const lastTranslateY = useRef(0);
  const [snapState, setSnapState] = useState<"half" | "full">(snapToHalf ? "half" : "full");

  // Open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setTranslateY(0);
      setSnapState(snapToHalf ? "half" : "full");
      // Force reflow then animate in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true);
        });
      });
      return undefined;
    }
    setIsAnimatingIn(false);
    const timer = setTimeout(() => setIsVisible(false), ANIMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen, snapToHalf]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [isOpen]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    dragStartY.current = touch.clientY;
    dragStartTime.current = Date.now();
    lastTranslateY.current = 0;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - dragStartY.current;
    // Only allow dragging down (positive delta)
    const clamped = Math.max(0, deltaY);
    setTranslateY(clamped);
    lastTranslateY.current = clamped;
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const elapsed = Date.now() - dragStartTime.current;
    const velocity = lastTranslateY.current / Math.max(elapsed, 1);

    if (lastTranslateY.current > DRAG_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      // If snapped to full and snapToHalf is on, snap to half first
      if (snapToHalf && snapState === "full") {
        setSnapState("half");
        setTranslateY(0);
      } else {
        onClose();
      }
    } else {
      setTranslateY(0);
    }
  }, [isDragging, onClose, snapToHalf, snapState]);

  const handleExpandToFull = useCallback(() => {
    if (snapState === "half") {
      setSnapState("full");
    }
  }, [snapState]);

  if (!isVisible) return null;

  const maxHeight = snapState === "half"
    ? `${Math.round(maxHeightPercent / 2)}vh`
    : `${maxHeightPercent}vh`;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity ${
          isAnimatingIn ? "opacity-50" : "opacity-0"
        }`}
        style={{ transitionDuration: `${ANIMATION_DURATION_MS}ms` }}
        onClick={onClose}
        role="presentation"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 flex flex-col rounded-t-2xl bg-[#212121] ${
          isDragging ? "" : "transition-transform"
        }`}
        style={{
          height: maxHeight,
          maxHeight,
          transform: `translateY(${isAnimatingIn ? translateY : 100}${isAnimatingIn ? "px" : "%"})`,
          transitionDuration: isDragging ? "0ms" : `${ANIMATION_DURATION_MS}ms`,
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle + header */}
        <div
          className="flex flex-col items-center pt-2 pb-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleExpandToFull}
          role="presentation"
        >
          <div className="h-1 w-10 rounded-full bg-[#606060]" />
          {title && (
            <div className="flex w-full items-center justify-between border-b border-[#333] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#f1f1f1]">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-[#aaa] active:bg-[#333]"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
