import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  PlayIcon,
  PauseIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  Forward10Icon,
  Replay10Icon,
  SubtitlesIcon,
  ChevronDownIcon,
} from "@/presentation/components/ui/Icons";
import type { SubtitleStream } from "@newpipe/shared";

/** Unique audio track option for the player settings panel. */
export interface AudioTrackOption {
  readonly locale: string;
  readonly displayName: string;
  readonly isDefault: boolean;
}

interface VideoPlayerControlsProps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly duration: number;
  readonly currentTime: number;
  readonly isPlaying: boolean;
  readonly isBuffering: boolean;
  readonly onPlayPause: () => void;
  readonly onSeek: (time: number) => void;
  readonly onMinimize: () => void;
  readonly title: string;
  readonly subtitle: string;
  /** Available qualities from the stream */
  readonly qualities?: readonly { label: string; value: string }[];
  readonly currentQuality?: string;
  readonly onQualityChange?: (value: string) => void;
  /** Available playback speeds */
  readonly playbackSpeed?: number;
  readonly onSpeedChange?: (speed: number) => void;
  /** Subtitle selection */
  readonly subtitles?: readonly SubtitleStream[];
  readonly activeSubtitle?: string | null;
  readonly onSubtitleChange?: (languageCode: string | null) => void;
  /** Audio track selection */
  readonly audioTracks?: readonly AudioTrackOption[];
  readonly activeAudioLocale?: string | null;
  readonly onAudioTrackChange?: (locale: string) => void;
}

const HIDE_DELAY_MS = 3000;
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * YouTube-style video player overlay controls.
 * - Tap to show/hide
 * - Auto-hide after 3 seconds
 * - Center play/pause with forward/backward 10s
 * - Bottom seek bar with time display
 * - Top bar with minimize + title
 * - Settings menu (quality, speed, subtitles)
 */
export function VideoPlayerControls({
  videoRef,
  duration,
  currentTime,
  isPlaying,
  isBuffering,
  onPlayPause,
  onSeek,
  onMinimize,
  title,
  subtitle,
  qualities,
  currentQuality,
  onQualityChange,
  playbackSpeed = 1,
  onSpeedChange,
  subtitles,
  activeSubtitle,
  onSubtitleChange,
  audioTracks,
  activeAudioLocale,
  onAudioTrackChange,
}: VideoPlayerControlsProps) {
  const [visible, setVisible] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"main" | "quality" | "speed" | "subtitles" | "audio">("main");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying && !showSettings) {
      hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    }
  }, [isPlaying, showSettings]);

  useEffect(() => {
    if (visible) {
      resetHideTimer();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [visible, resetHideTimer]);

  // Show controls when paused
  useEffect(() => {
    if (!isPlaying) {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else if (visible) {
      resetHideTimer();
    }
  }, [isPlaying, visible, resetHideTimer]);

  // Track fullscreen changes and unlock orientation on exit
  useEffect(() => {
    function handleFullscreenChange() {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
        if (orientation.unlock) {
          orientation.unlock();
        }
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function handleContainerTap(event: React.MouseEvent) {
    // Don't toggle if tapping on a control button
    if ((event.target as HTMLElement).closest("button, [role=slider]")) return;
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    setVisible((prev) => !prev);
  }

  function handleSeekStart(event: React.TouchEvent | React.MouseEvent) {
    setIsSeeking(true);
    updateSeekPosition(event);
  }

  function handleSeekMove(event: React.TouchEvent | React.MouseEvent) {
    if (!isSeeking) return;
    updateSeekPosition(event);
  }

  function handleSeekEnd() {
    if (!isSeeking) return;
    setIsSeeking(false);
    onSeek(seekPosition);
  }

  function updateSeekPosition(event: React.TouchEvent | React.MouseEvent) {
    const bar = seekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clientX = "touches" in event
      ? (event.touches[0]?.clientX ?? 0)
      : event.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setSeekPosition(ratio * duration);
  }

  function handleForward() {
    const newTime = Math.min(duration, currentTime + 10);
    onSeek(newTime);
    resetHideTimer();
  }

  function handleRewind() {
    const newTime = Math.max(0, currentTime - 10);
    onSeek(newTime);
    resetHideTimer();
  }

  async function handleFullscreen() {
    const container = containerRef.current?.closest(".video-player-container") as HTMLElement | null;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
        // Lock to landscape on mobile
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (orientation.lock) {
          orientation.lock("landscape").catch(() => {});
        }
      }
    } catch {
      // Fullscreen not supported
    }
  }

  const displayTime = isSeeking ? seekPosition : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;
  const buffered = getBufferedPercent(videoRef.current, duration);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      onClick={handleContainerTap}
      role="presentation"
    >
      {/* Buffering spinner — always visible independently of controls */}
      {isBuffering && !visible && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
        </div>
      )}

      {/* Controls overlay with gradient backgrounds */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-200 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* ── Top bar: gradient + minimize + title ── */}
        <div className="bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().then(onMinimize).catch(onMinimize);
                } else {
                  onMinimize();
                }
              }}
              className="rounded-full p-1 text-white active:bg-white/20"
              aria-label="Minimize"
            >
              <ChevronDownIcon width={24} height={24} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white drop-shadow-sm">
                {title}
              </p>
              <p className="truncate text-[11px] text-white/70">{subtitle}</p>
            </div>
            {/* Settings gear */}
            <button
              type="button"
              onClick={() => {
                setShowSettings(!showSettings);
                setSettingsTab("main");
              }}
              className="rounded-full p-1.5 text-white active:bg-white/20"
              aria-label="Ajustes"
            >
              <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Center controls ── */}
        <div className="flex items-center justify-center gap-12">
          {/* Rewind 10s */}
          <button
            type="button"
            onClick={handleRewind}
            className="rounded-full p-2 text-white/90 active:bg-white/20"
            aria-label="Rewind 10 seconds"
          >
            <Replay10Icon width={36} height={36} />
          </button>

          {/* Play/Pause */}
          {isBuffering ? (
            <div className="flex h-14 w-14 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onPlayPause();
                resetHideTimer();
              }}
              className="rounded-full bg-black/40 p-3 text-white active:bg-black/60"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon width={36} height={36} />
              ) : (
                <PlayIcon width={36} height={36} />
              )}
            </button>
          )}

          {/* Forward 10s */}
          <button
            type="button"
            onClick={handleForward}
            className="rounded-full p-2 text-white/90 active:bg-white/20"
            aria-label="Forward 10 seconds"
          >
            <Forward10Icon width={36} height={36} />
          </button>
        </div>

        {/* ── Bottom bar: seek bar + time + fullscreen ── */}
        <div className="bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2">
          {/* Seek bar */}
          <div
            ref={seekBarRef}
            className="group relative flex h-6 cursor-pointer items-center"
            onTouchStart={handleSeekStart}
            onTouchMove={handleSeekMove}
            onTouchEnd={handleSeekEnd}
            onMouseDown={handleSeekStart}
            onMouseMove={handleSeekMove}
            onMouseUp={handleSeekEnd}
            onMouseLeave={() => isSeeking && handleSeekEnd()}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={displayTime}
            tabIndex={0}
          >
            {/* Track background */}
            <div className="absolute left-0 right-0 h-[3px] rounded-full bg-white/30">
              {/* Buffered */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-white/40"
                style={{ width: `${buffered}%` }}
              />
              {/* Progress */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-[#f00]"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f00] transition-transform ${
                isSeeking ? "scale-150" : "scale-100"
              }`}
              style={{ left: `${progress}%` }}
            />
          </div>

          {/* Time + controls row */}
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/90">
              {formatTime(displayTime)} / {formatTime(duration)}
            </span>
            <div className="flex items-center gap-1">
              {/* Subtitles toggle */}
              {subtitles && subtitles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeSubtitle) {
                      onSubtitleChange?.(null);
                    } else {
                      onSubtitleChange?.(subtitles[0]!.languageCode);
                    }
                  }}
                  className={`rounded-full p-1.5 active:bg-white/20 ${
                    activeSubtitle ? "text-white" : "text-white/50"
                  }`}
                  aria-label="Subtitles"
                >
                  <SubtitlesIcon width={20} height={20} />
                </button>
              )}
              {/* Fullscreen */}
              <button
                type="button"
                onClick={handleFullscreen}
                className="rounded-full p-1.5 text-white active:bg-white/20"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <FullscreenExitIcon width={22} height={22} />
                ) : (
                  <FullscreenIcon width={22} height={22} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings bottom sheet (YouTube-style) — rendered via portal ── */}
      {showSettings && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center"
          onClick={() => setShowSettings(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 animate-fade-in" />

          {/* Sheet */}
          <div
            className="relative w-full max-w-lg animate-slide-up rounded-t-2xl bg-[#212121]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="h-1 w-10 rounded-full bg-[#555]" />
            </div>

            {settingsTab === "main" && (
              <div className="pb-6">
                {/* Quality row */}
                <button
                  type="button"
                  onClick={() => setSettingsTab("quality")}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-white/5"
                >
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="#aaa">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                  <span className="flex-1 text-[15px] text-white">Calidad</span>
                  <span className="text-[14px] text-[#aaa]">{currentQuality ?? "Automática"}</span>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="#717171"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                </button>

                {/* Speed row */}
                {onSpeedChange && (
                  <button
                    type="button"
                    onClick={() => setSettingsTab("speed")}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-white/5"
                  >
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="#aaa">
                      <path d="M10 8v8l6-4-6-4zm1 0 3.5 2.5v3L11 16V8z" opacity="0" />
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1.5-3.5 6-4.5-6-4.5v9z" />
                    </svg>
                    <span className="flex-1 text-[15px] text-white">Velocidad de reproducción</span>
                    <span className="text-[14px] text-[#aaa]">{playbackSpeed === 1 ? "1x" : `${playbackSpeed}x`}</span>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="#717171"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                  </button>
                )}

                {/* Subtitles row */}
                {subtitles && subtitles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSettingsTab("subtitles")}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-white/5"
                  >
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="#aaa">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z" />
                    </svg>
                    <span className="flex-1 text-[15px] text-white">Subtítulos</span>
                    <span className="text-[14px] text-[#aaa]">
                      {activeSubtitle
                        ? subtitles.find((s) => s.languageCode === activeSubtitle)?.displayLanguage ?? activeSubtitle
                        : "Desactivados"}
                    </span>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="#717171"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                  </button>
                )}

                {/* Audio track row */}
                {audioTracks && audioTracks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSettingsTab("audio")}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-white/5"
                  >
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="#aaa">
                      <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                    </svg>
                    <span className="flex-1 text-[15px] text-white">Pista de audio</span>
                    <span className="text-[14px] text-[#aaa]">
                      {audioTracks.find((t) => t.locale === activeAudioLocale)?.displayName ?? "Original"}
                    </span>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="#717171"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                  </button>
                )}

                {/* Lock screen row */}
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left active:bg-white/5"
                >
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="#aaa">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                  </svg>
                  <span className="flex-1 text-[15px] text-white">Bloquear pantalla</span>
                </button>
              </div>
            )}

            {settingsTab === "speed" && (
              <div className="pb-6">
                <button
                  type="button"
                  onClick={() => setSettingsTab("main")}
                  className="flex w-full items-center gap-3 border-b border-[#333] px-5 py-3 text-left"
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                  <span className="text-[15px] font-semibold text-white">Velocidad de reproducción</span>
                </button>
                {SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => { onSpeedChange?.(speed); setShowSettings(false); }}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-white/5 ${
                      playbackSpeed === speed ? "text-[#3ea6ff]" : "text-white"
                    }`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {playbackSpeed === speed && (
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[14px]">{speed === 1 ? "Normal" : `${speed}x`}</span>
                  </button>
                ))}
              </div>
            )}

            {settingsTab === "quality" && (
              <div className="pb-6">
                <button
                  type="button"
                  onClick={() => setSettingsTab("main")}
                  className="flex w-full items-center gap-3 border-b border-[#333] px-5 py-3 text-left"
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                  <span className="text-[15px] font-semibold text-white">Calidad</span>
                </button>
                {qualities && qualities.length > 0 ? (
                  qualities.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      onClick={() => { onQualityChange?.(q.value); setShowSettings(false); }}
                      className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-white/5 ${
                        currentQuality === q.value ? "text-[#3ea6ff]" : "text-white"
                      }`}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {currentQuality === q.value && (
                          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[14px]">{q.label}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-5 py-4 text-[14px] text-[#aaa]">Automática</p>
                )}
              </div>
            )}

            {settingsTab === "subtitles" && (
              <div className="pb-6">
                <button
                  type="button"
                  onClick={() => setSettingsTab("main")}
                  className="flex w-full items-center gap-3 border-b border-[#333] px-5 py-3 text-left"
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                  <span className="text-[15px] font-semibold text-white">Subtítulos</span>
                </button>
                {/* Disable option */}
                <button
                  type="button"
                  onClick={() => { onSubtitleChange?.(null); setShowSettings(false); }}
                  className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-white/5 ${
                    activeSubtitle === null ? "text-[#3ea6ff]" : "text-white"
                  }`}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {activeSubtitle === null && (
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[14px]">Desactivar</span>
                </button>
                {subtitles?.map((sub) => (
                  <button
                    key={sub.languageCode}
                    type="button"
                    onClick={() => { onSubtitleChange?.(sub.languageCode); setShowSettings(false); }}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-white/5 ${
                      activeSubtitle === sub.languageCode ? "text-[#3ea6ff]" : "text-white"
                    }`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {activeSubtitle === sub.languageCode && (
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[14px]">
                      {sub.displayLanguage}
                      {sub.autoGenerated ? " (auto)" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {settingsTab === "audio" && (
              <div className="pb-6">
                <button
                  type="button"
                  onClick={() => setSettingsTab("main")}
                  className="flex w-full items-center gap-3 border-b border-[#333] px-5 py-3 text-left"
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                  <span className="text-[15px] font-semibold text-white">Pista de audio</span>
                </button>
                {audioTracks?.map((track) => (
                  <button
                    key={track.locale}
                    type="button"
                    onClick={() => { onAudioTrackChange?.(track.locale); setShowSettings(false); }}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-white/5 ${
                      activeAudioLocale === track.locale ? "text-[#3ea6ff]" : "text-white"
                    }`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {activeAudioLocale === track.locale && (
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[14px]">
                      {track.displayName}
                      {track.isDefault ? " (original)" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const paddedSecs = secs.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${paddedSecs}`;
  }
  return `${minutes}:${paddedSecs}`;
}

function getBufferedPercent(video: HTMLVideoElement | null, duration: number): number {
  if (!video || duration <= 0 || video.buffered.length === 0) return 0;
  const lastBuffered = video.buffered.end(video.buffered.length - 1);
  return (lastBuffered / duration) * 100;
}
