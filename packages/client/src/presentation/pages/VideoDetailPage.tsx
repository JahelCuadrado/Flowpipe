import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import Hls from "hls.js";
import { fetchStreamInfo, fetchCommentsInfo, fetchCommentsNextPage } from "@/infrastructure/api/ApiService";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { usePlayerStore } from "@/application/stores/playerStore";
import { useSubscription } from "@/application/hooks/useSubscription";
import { useAsync } from "@/application/hooks/useAsync";
import { recordStreamView } from "@/application/services/PersistenceService";
import { database } from "@/infrastructure/database/AppDatabase";
import { VideoCard } from "@/presentation/components/ui/VideoCard";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { VideoDetailSkeleton } from "@/presentation/components/ui/VideoDetailSkeleton";
import { VideoPlayerControls } from "@/presentation/components/player/VideoPlayerControls";
import { RetryImage } from "@/presentation/components/ui/RetryImage";
import type { AudioTrackOption } from "@/presentation/components/player/VideoPlayerControls";
import { BottomSheet } from "@/presentation/components/ui/BottomSheet";
import { ThumbUpIcon, ThumbDownIcon, ShareIcon, SaveIcon, DownloadIcon, CommentIcon } from "@/presentation/components/ui/Icons";
import { flushSync } from "react-dom";
import type { StreamInfo, VideoStream, AudioStream, CommentInfo, CommentItem, Page, SubtitleStream } from "@newpipe/shared";

/**
 * Fetches subtitle VTT files and returns blob URLs that bypass cross-origin restrictions.
 * In Capacitor APK this is unnecessary (native fetch has no CORS), but works everywhere.
 */
function useSubtitleBlobUrls(subtitles: readonly SubtitleStream[]): Map<string, string> {
  const [blobMap, setBlobMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (subtitles.length === 0) return;

    let cancelled = false;
    const urls: string[] = [];

    (async () => {
      const entries: [string, string][] = [];
      for (const sub of subtitles) {
        try {
          const response = await fetch(sub.url);
          if (!response.ok) continue;
          const text = await response.text();
          const blob = new Blob([text], { type: "text/vtt" });
          const blobUrl = URL.createObjectURL(blob);
          urls.push(blobUrl);
          entries.push([sub.languageCode, blobUrl]);
        } catch {
          // Skip failed subtitle downloads silently
        }
      }
      if (!cancelled) {
        setBlobMap(new Map(entries));
      }
    })();

    return () => {
      cancelled = true;
      for (const u of urls) {
        URL.revokeObjectURL(u);
      }
    };
  }, [subtitles]);

  return blobMap;
}

export default function VideoDetailPage() {
  const url = usePlayerStore((s) => s.overlayVideoUrl) ?? "";
  const preloadData = usePlayerStore((s) => s.overlayPreloadData);
  const serviceId = useSettingsStore((s) => s.defaultServiceId);
  const showRelated = useSettingsStore((s) => s.showRelatedStreams);
  const showComments = useSettingsStore((s) => s.showComments);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsData, setCommentsData] = useState<CommentInfo | null>(null);
  const [commentsError, setCommentsError] = useState(false);
  const contentFadeRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, refetch } = useAsync(
    () => (url ? fetchStreamInfo(serviceId, url) : Promise.resolve(null)),
    [url, serviceId]
  );

  // Fetch comments once and share between preview and sheet
  useEffect(() => {
    if (!url || !showComments) return;
    let cancelled = false;
    setCommentsData(null);
    setCommentsError(false);
    fetchCommentsInfo(serviceId, url)
      .then((result) => { if (!cancelled) setCommentsData(result); })
      .catch(() => { if (!cancelled) setCommentsError(true); });
    return () => { cancelled = true; };
  }, [url, serviceId, showComments]);

  // Record watch history when stream data loads
  useEffect(() => {
    if (data && useSettingsStore.getState().showWatchHistory) {
      recordStreamView(data).catch(() => {});
    }
  }, [data]);

  if (!url) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-text-secondary)]">No video URL provided</p>
      </div>
    );
  }

  if (loading) {
    // Show skeleton with pre-loaded card data instead of a blank spinner
    if (preloadData) {
      return <VideoDetailSkeleton preloadData={preloadData} />;
    }
    return (
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
    );
  }
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="flex flex-col bg-[#0f0f0f]">
      <VideoPlayer info={data} contentFadeRef={contentFadeRef} />
      <div ref={contentFadeRef}>
        <VideoMetadataYT info={data} />
        <ActionButtonsRow info={data} url={url} onOpenComments={() => setCommentsOpen(true)} serviceId={serviceId} />

        {/* Comments preview card */}
        {showComments && (
          <CommentsPreviewCard
            commentsData={commentsData}
            hasError={commentsError}
            onOpenComments={() => setCommentsOpen(true)}
          />
        )}

        {showRelated && data.relatedItems.length > 0 && (
          <RelatedVideos info={data} />
        )}
      </div>
      {/* Comments bottom sheet */}
      {showComments && (
        <BottomSheet
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          title="Comentarios"
          maxHeightPercent={90}
        >
          <CommentsSheetContent
            commentsData={commentsData}
            hasError={commentsError}
            url={url}
            serviceId={serviceId}
            onRetry={() => {
              setCommentsData(null);
              setCommentsError(false);
              fetchCommentsInfo(serviceId, url)
                .then(setCommentsData)
                .catch(() => setCommentsError(true));
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
}

// ─── Video Player ────────────────────────────────────────────────────────────

/**
 * Playback mode selection result.
 * Priority depends on platform:
 * - Browser: combined → separate → HLS (progressive download is fastest)
 * - Capacitor: combined → HLS → separate (CapacitorHttp breaks <video src> range requests)
 */
interface PlaybackConfig {
  readonly mode: "combined" | "separate" | "hls" | "none";
  readonly videoUrl: string | null;
  readonly audioUrl: string | null;
  readonly hlsUrl: string | null;
}

/** True when running inside a Capacitor native shell (APK). */
const IS_CAPACITOR = typeof window !== "undefined"
  && "Capacitor" in window
  && (window as Record<string, unknown>)["Capacitor"] !== undefined;

function resolvePlaybackConfig(
  info: StreamInfo,
  preferredResolution: string,
  preferredAudioLocale?: string | null,
  disableAiDubbing?: boolean,
): PlaybackConfig {
  // When the user explicitly chose a non-default audio locale, skip combined
  // streams because their audio track is baked in and cannot be switched.
  const hasCustomAudioLocale = !!preferredAudioLocale;

  // 1. Combined progressive stream (audio+video in one file) — works everywhere
  //    but only when the user hasn't picked a specific audio track.
  if (!hasCustomAudioLocale) {
    const combinedStream = selectVideoStream(info.videoStreams, preferredResolution);
    if (combinedStream?.url) {
      return { mode: "combined", videoUrl: combinedStream.url, audioUrl: null, hlsUrl: null };
    }
  }

  // In Capacitor, CapacitorHttp intercepts <video>/<audio> src requests
  // and breaks HTTP Range Requests needed for progressive streaming.
  // Prefer HLS which uses XHR (properly patched by CapacitorHttp) + MediaSource API.
  if (IS_CAPACITOR) {
    // 2a. HLS manifest via hls.js (Capacitor-preferred)
    if (info.hlsUrl) {
      return { mode: "hls", videoUrl: null, audioUrl: null, hlsUrl: info.hlsUrl };
    }

    // 2b. Separate as last resort in Capacitor
    const videoOnly = selectVideoStream(info.videoOnlyStreams, preferredResolution);
    const audio = selectAudioStream(info.audioStreams, preferredAudioLocale, disableAiDubbing);
    if (videoOnly?.url) {
      return { mode: "separate", videoUrl: videoOnly.url, audioUrl: audio?.url ?? null, hlsUrl: null };
    }
  } else {
    // 2. Separate video-only + audio (browser — most reliable, best quality)
    const videoOnly = selectVideoStream(info.videoOnlyStreams, preferredResolution);
    const audio = selectAudioStream(info.audioStreams, preferredAudioLocale, disableAiDubbing);
    if (videoOnly?.url) {
      return { mode: "separate", videoUrl: videoOnly.url, audioUrl: audio?.url ?? null, hlsUrl: null };
    }

    // 3. HLS manifest via hls.js
    if (info.hlsUrl) {
      return { mode: "hls", videoUrl: null, audioUrl: null, hlsUrl: info.hlsUrl };
    }
  }

  return { mode: "none", videoUrl: null, audioUrl: null, hlsUrl: null };
}

interface VideoPlayerProps {
  readonly info: StreamInfo;
  readonly contentFadeRef: React.RefObject<HTMLDivElement | null>;
}

// ── Mini player target dimensions (must match MiniPlayer.tsx) ──
const MINI_WIDTH = 180;
const MINI_HEIGHT = 101;
const MINI_EDGE_MARGIN = 8;
const MINI_BOTTOM_OFFSET = 60;
// Minimum drag distance (px) to commit the minimize gesture
const SWIPE_COMMIT_PIXELS = 140;

function VideoPlayer({ info, contentFadeRef }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerStore = usePlayerStore();
  const defaultResolution = useSettingsStore((s) => s.defaultResolution);
  const isOverlayVisible = usePlayerStore((s) => s.isOverlayVisible);
  const positionSaveRef = useRef<ReturnType<typeof setInterval>>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const subtitleBlobUrls = useSubtitleBlobUrls(info.subtitles);
  const disableAiDubbing = useSettingsStore((s) => s.disableAiDubbing);

  // ── Build unique audio track options from available streams ──
  const audioTracks = useMemo((): readonly AudioTrackOption[] => {
    const seen = new Map<string, AudioTrackOption>();
    for (const stream of info.audioStreams) {
      const locale = stream.audioLocale;
      if (!locale || seen.has(locale)) continue;
      seen.set(locale, {
        locale,
        displayName: stream.audioTrackName ?? locale,
        isDefault: stream.audioIsDefault,
      });
    }
    return Array.from(seen.values());
  }, [info.audioStreams]);

  // Active audio locale: default to the original/default track
  const defaultAudioLocale = useMemo(() => {
    const defaultTrack = audioTracks.find((t) => t.isDefault);
    return defaultTrack?.locale ?? audioTracks[0]?.locale ?? null;
  }, [audioTracks]);

  const [activeAudioLocale, setActiveAudioLocale] = useState<string | null>(null);
  const resolvedAudioLocale = activeAudioLocale ?? defaultAudioLocale;

  // ── Progressive swipe-down to minimize (morph toward mini player) ──
  const swipeStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeOffsetRef = useRef(0);
  const rafIdRef = useRef(0);

  // Cache layout dimensions once at swipe start to avoid reflows during gesture
  const layoutRef = useRef({ vw: 0, playerW: 0, playerH: 0, fullDist: 0 });

  const applyMorphFrame = useCallback(() => {
    const container = containerRef.current;
    const content = contentFadeRef.current;
    if (!container) return;

    const offset = swipeOffsetRef.current;
    const { vw, playerW, playerH, fullDist } = layoutRef.current;
    const progress = fullDist > 0 ? Math.min(1, Math.max(0, offset / fullDist)) : 0;

    if (offset === 0) {
      container.style.transform = "";
      container.style.borderRadius = "";
      container.style.boxShadow = "";
      container.style.overflow = "";
      container.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1), border-radius 0.25s";
      if (content) {
        content.style.opacity = "";
        content.style.transform = "";
        content.style.transition = "opacity 0.25s, transform 0.25s";
        content.style.pointerEvents = "";
      }
      return;
    }

    const targetScaleX = MINI_WIDTH / playerW;
    const targetScaleY = MINI_HEIGHT / playerH;
    const scaleX = 1 - progress * (1 - targetScaleX);
    const scaleY = 1 - progress * (1 - targetScaleY);

    const finalX = vw - MINI_EDGE_MARGIN - MINI_WIDTH / 2 - playerW / 2;
    const translateX = progress * finalX;
    const scaleCompensationY = playerH * (1 - scaleY) / 2;
    const translateY = offset - scaleCompensationY;

    const radiusProgress = Math.min(1, progress * 4);
    const targetVisual = radiusProgress * 8;
    const cssRadiusX = scaleX > 0 ? targetVisual / scaleX : targetVisual;
    const cssRadiusY = scaleY > 0 ? targetVisual / scaleY : targetVisual;

    const shadowOpacity = Math.min(0.6, progress * 2.4);
    const shadowBlur = 50 * Math.min(1, progress * 3);
    const shadowY = 25 * Math.min(1, progress * 3);
    const shadowSpread = -12 * Math.min(1, progress * 3);

    container.style.transition = "none";
    container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    container.style.borderRadius = `${cssRadiusX}px / ${cssRadiusY}px`;
    container.style.overflow = "hidden";
    container.style.boxShadow = progress > 0.02
      ? `0 ${shadowY}px ${shadowBlur}px ${shadowSpread}px rgba(0,0,0,${shadowOpacity})`
      : "";

    if (content) {
      content.style.transition = "none";
      content.style.opacity = `${Math.max(0, 1 - progress * 5)}`;
      content.style.transform = `translateY(${progress * 40}px)`;
      content.style.pointerEvents = "none";
    }
  }, []);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0]!.clientY;
    // Cache layout dimensions once
    const vw = window.innerWidth;
    const playerW = containerRef.current?.offsetWidth ?? vw;
    const playerH = containerRef.current?.offsetHeight ?? (vw * 9) / 16;
    const fullDist = window.innerHeight - MINI_BOTTOM_OFFSET - MINI_HEIGHT / 2 - playerH / 2;
    layoutRef.current = { vw, playerW, playerH, fullDist };
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (swipeStartY.current === null) return;
    const deltaY = e.touches[0]!.clientY - swipeStartY.current;
    if (deltaY > 0) {
      swipeOffsetRef.current = deltaY;
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(applyMorphFrame);
    }
  }, [applyMorphFrame]);

  const handleSwipeEnd = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    if (swipeOffsetRef.current >= SWIPE_COMMIT_PIXELS) {
      // Commit: minimize overlay → MiniPlayer takes over
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          flushSync(() => usePlayerStore.getState().minimizeOverlay());
        });
      } else {
        usePlayerStore.getState().minimizeOverlay();
      }
    }
    swipeOffsetRef.current = 0;
    swipeStartY.current = null;
    applyMorphFrame();
  }, [applyMorphFrame]);

  const playerContainerStyle = useMemo((): React.CSSProperties => ({
    viewTransitionName: isOverlayVisible ? "hero-thumbnail" : undefined,
  }), [isOverlayVisible]);

  const playback = useMemo(
    () => resolvePlaybackConfig(info, defaultResolution, resolvedAudioLocale, disableAiDubbing),
    [info, defaultResolution, resolvedAudioLocale, disableAiDubbing]
  );

  // ── Sync audio element with video (for "separate" mode) ──
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || playback.mode !== "separate") return;

    const syncAudioToVideo = () => {
      if (Math.abs(video.currentTime - audio.currentTime) > 0.3) {
        audio.currentTime = video.currentTime;
      }
    };

    const onPlay = () => { audio.play().catch(() => {}); syncAudioToVideo(); };
    const onPause = () => { audio.pause(); };
    const onSeeked = () => { syncAudioToVideo(); };
    const onRateChange = () => { audio.playbackRate = video.playbackRate; };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ratechange", onRateChange);

    // Periodic drift correction
    const driftInterval = setInterval(syncAudioToVideo, 3000);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ratechange", onRateChange);
      clearInterval(driftInterval);
    };
  }, [playback.mode]);

  // ── Attach HLS.js when using HLS manifest ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || playback.mode !== "hls" || !playback.hlsUrl) return;

    // Safari supports HLS natively. In Capacitor however, the WebView
    // reports partial HLS support but CapacitorHttp intercepts the media
    // requests and breaks streaming, so always use HLS.js there.
    if (!IS_CAPACITOR && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playback.hlsUrl;
      return;
    }

    if (!Hls.isSupported()) return;

    const corsProxy = import.meta.env["VITE_CORS_PROXY_URL"] as string | undefined;

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      ...(corsProxy ? {
        xhrSetup: (xhr: XMLHttpRequest, url: string) => {
          const proxiedUrl = `${corsProxy}?url=${encodeURIComponent(url)}`;
          xhr.open("GET", proxiedUrl, true);
        },
      } : {}),
    });

    hls.loadSource(playback.hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          usePlayerStore.getState().setStatus("error");
        }
      }
    });

    hlsRef.current = hls;

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- playerStore stable via zustand; including causes infinite re-mount
  }, [playback.mode, playback.hlsUrl]);

  // ── Switch HLS.js audio track when the user picks a different locale ──
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || !resolvedAudioLocale) return;
    const tracks = hls.audioTracks;
    if (tracks.length <= 1) return;
    const targetIndex = tracks.findIndex((t) =>
      t.lang === resolvedAudioLocale || t.name?.toLowerCase().includes(resolvedAudioLocale)
    );
    if (targetIndex >= 0 && targetIndex !== hls.audioTrack) {
      hls.audioTrack = targetIndex;
    }
  }, [resolvedAudioLocale]);

  // Restore playback position from DB
  useEffect(() => {
    (async () => {
      const existing = await database.streams
        .where("[serviceId+url]")
        .equals([info.serviceId, info.url])
        .first();
      if (!existing?.id) return;
      const state = await database.streamStates.get(existing.id);
      if (state && videoRef.current && state.progressMillis > 0) {
        videoRef.current.currentTime = state.progressMillis / 1000;
      }
    })();
  }, [info.serviceId, info.url]);

  useEffect(() => {
    if (info.name) {
      playerStore.play(
        info.url,
        info.name,
        info.uploaderName ?? "",
        info.thumbnails[0]?.url ?? null
      );
    }

    // Save position every 5 seconds
    positionSaveRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      const currentTime = Math.floor(videoRef.current.currentTime * 1000);
      if (currentTime <= 0) return;
      const existing = await database.streams
        .where("[serviceId+url]")
        .equals([info.serviceId, info.url])
        .first();
      if (existing?.id !== undefined) {
        await database.streamStates.put({ streamId: existing.id, progressMillis: currentTime });
      }
    }, 5000);

    return () => {
      if (positionSaveRef.current) clearInterval(positionSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.url]);

  // ── Media Session API for lock screen / notification controls ──
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: info.name,
      artist: info.uploaderName ?? "Unknown",
      artwork: info.thumbnails.map((t) => ({
        src: t.url,
        sizes: `${t.width}x${t.height}`,
        type: "image/jpeg",
      })),
    });

    const video = videoRef.current;
    if (!video) return;

    navigator.mediaSession.setActionHandler("play", () => {
      video.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      video.pause();
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        video.currentTime = details.seekTime;
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [info.name, info.uploaderName, info.thumbnails]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      playerStore.setPosition(Math.floor(videoRef.current.currentTime));
    }
  }, [playerStore]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      playerStore.setDuration(Math.floor(videoRef.current.duration));
      playerStore.setStatus("playing");
    }
  }, [playerStore]);

  // Toggle subtitle track on the <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i]!;
      track.mode = track.language === activeSubtitle ? "showing" : "hidden";
    }
  }, [activeSubtitle]);

  // Sync store-driven play/pause to the actual video element.
  // Allows MiniPlayer buttons to control playback when overlay is hidden.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playerStore.status === "playing" && video.paused) {
      video.play().catch(() => {});
    } else if (playerStore.status === "paused" && !video.paused) {
      video.pause();
    }
  }, [playerStore.status]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    if (audioRef.current && playback.mode === "separate") {
      audioRef.current.currentTime = time;
    }
  }, [playback.mode]);

  const handleMinimize = useCallback(() => {
    // Morph player → MiniPlayer via View Transitions API
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(() => usePlayerStore.getState().minimizeOverlay());
      });
    } else {
      usePlayerStore.getState().minimizeOverlay();
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  }, []);

  const isPlaying = playerStore.status === "playing";
  const isBuffering = playerStore.status === "buffering";

  return (
    <div
      ref={containerRef}
      className="video-player-container relative aspect-video w-full bg-black"
      style={playerContainerStyle}
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
    >
      {playback.mode !== "none" ? (
        <>
          <video
            ref={videoRef}
            src={playback.mode === "hls" ? undefined : (playback.videoUrl ?? undefined)}
            poster={info.thumbnails[info.thumbnails.length - 1]?.url}
            autoPlay={playback.mode !== "hls"}
            playsInline
            className="h-full w-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => playerStore.setStatus("playing")}
            onPause={() => playerStore.setStatus("paused")}
            onWaiting={() => playerStore.setStatus("buffering")}
            onError={(e) => {
              const video = e.currentTarget;
              const err = video.error;
              console.error("[Player] Video error:", err?.code, err?.message);
              playerStore.setStatus("error");
            }}
            onCanPlay={() => {
              const video = videoRef.current;
              if (!video) return;
              if (video.paused) {
                video.play().catch(() => {});
              } else {
                playerStore.setStatus("playing");
              }
            }}
          >
            {info.subtitles.map((sub) => {
              const blobUrl = subtitleBlobUrls.get(sub.languageCode);
              if (!blobUrl) return null;
              return (
                <track
                  key={sub.languageCode}
                  kind="subtitles"
                  srcLang={sub.languageCode}
                  label={sub.displayLanguage}
                  src={blobUrl}
                />
              );
            })}
          </video>

          {/* YouTube-style custom controls overlay */}
          <VideoPlayerControls
            videoRef={videoRef}
            duration={playerStore.duration}
            currentTime={playerStore.position}
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onMinimize={handleMinimize}
            title={info.name}
            subtitle={info.uploaderName ?? ""}
            subtitles={info.subtitles}
            activeSubtitle={activeSubtitle}
            onSubtitleChange={setActiveSubtitle}
            audioTracks={disableAiDubbing
              ? audioTracks.filter((t) => t.isDefault || audioTracks.length <= 1)
              : audioTracks}
            activeAudioLocale={resolvedAudioLocale}
            onAudioTrackChange={setActiveAudioLocale}
            playbackSpeed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
          />

          {/* Hidden audio element for separate video+audio playback */}
          {playback.mode === "separate" && playback.audioUrl && (
            <audio ref={audioRef} src={playback.audioUrl} preload="auto" />
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No playable stream found</p>
        </div>
      )}
    </div>
  );
}

function selectVideoStream(
  streams: readonly VideoStream[],
  preferredResolution: string
): VideoStream | null {
  if (streams.length === 0) return null;

  const targetHeight = parseInt(preferredResolution, 10) || 720;

  // Filter combined streams (video + audio)
  const combined = streams.filter((s) => !s.isVideoOnly);
  const pool = combined.length > 0 ? combined : streams;

  // Find closest to target
  let best = pool[0]!;
  let bestDiff = Math.abs((best.height ?? 0) - targetHeight);

  for (const s of pool) {
    const diff = Math.abs((s.height ?? 0) - targetHeight);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }

  return best;
}

/**
 * Selects the best audio stream, preferring higher bitrate.
 * When a preferredLocale is given, only streams matching that locale are considered.
 * When disableAiDubbing is true, only the default (original) track is used.
 */
function selectAudioStream(
  streams: readonly AudioStream[],
  preferredLocale?: string | null,
  disableAiDubbing?: boolean,
): AudioStream | null {
  if (streams.length === 0) return null;

  let pool = [...streams];

  // Filter by AI dubbing preference: keep only default (original) tracks
  if (disableAiDubbing) {
    const defaultOnly = pool.filter((s) => s.audioIsDefault || !s.audioTrackId);
    if (defaultOnly.length > 0) pool = defaultOnly;
  }

  // Filter by preferred locale if provided
  if (preferredLocale) {
    const localeMatch = pool.filter((s) => s.audioLocale === preferredLocale);
    if (localeMatch.length > 0) pool = localeMatch;
  }

  let best = pool[0]!;
  for (const s of pool) {
    if (s.averageBitrate > best.averageBitrate) {
      best = s;
    }
  }

  return best;
}

// ─── Video Metadata (YouTube-style) ──────────────────────────────────────────

function VideoMetadataYT({ info }: { readonly info: StreamInfo }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const serviceId = useSettingsStore((s) => s.defaultServiceId);

  const {
    isSubscribed,
    toggle: toggleSubscription,
  } = useSubscription(
    serviceId,
    info.uploaderUrl,
    info.uploaderName,
    info.uploaderAvatars[0]?.url ?? null,
    info.uploaderSubscriberCount,
    null
  );

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      {/* Title — expandable */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-left"
      >
        <h1 className={`text-[15px] font-semibold leading-snug text-[#f1f1f1] ${expanded ? "" : "line-clamp-2"}`}>
          {info.name}
        </h1>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#aaa]">
          {info.viewCount !== null && <span>{formatViewCount(info.viewCount)}</span>}
          {info.textualUploadDate && (
            <>
              <span>·</span>
              <span>{info.textualUploadDate}</span>
            </>
          )}
          <span className="text-[#aaa]">{expanded ? "...menos" : "...más"}</span>
        </div>
      </button>

      {/* Expanded description */}
      {expanded && info.description && (
        <p className="text-[13px] leading-relaxed text-[#aaa]">{info.description}</p>
      )}

      {/* Channel row */}
      {info.uploaderName && (
        <div className="flex items-center gap-2.5 py-1">
          <button
            type="button"
            onClick={() => info.uploaderUrl && navigate(`/channel?url=${encodeURIComponent(info.uploaderUrl)}`)}
            className="flex flex-1 items-center gap-2.5 text-left"
          >
            {info.uploaderAvatars[0]?.url ? (
              <RetryImage
                src={info.uploaderAvatars[0].url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-[#333]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[13px] font-medium text-[#f1f1f1]">
                <span className="truncate">{info.uploaderName}</span>
                {info.uploaderVerified && (
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="#aaa" className="shrink-0">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                )}
              </p>
              {info.uploaderSubscriberCount !== null && (
                <p className="text-[11px] text-[#aaa]">
                  {formatCount(info.uploaderSubscriberCount)} suscriptores
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={toggleSubscription}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              isSubscribed
                ? "bg-[#272727] text-[#aaa]"
                : "bg-white text-black"
            }`}
          >
            {isSubscribed ? "Suscrito/a" : "Suscribirme"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Action Buttons Row (YouTube horizontal scroll) ──────────────────────────

function ActionButtonsRow({
  info,
  url,
  onOpenComments,
}: {
  readonly info: StreamInfo;
  readonly url: string;
  readonly onOpenComments: () => void;
  readonly serviceId: number;
}) {
  return (
    <div className="overflow-x-auto border-b border-[#272727] px-3 py-2 scrollbar-none">
      <div className="flex items-center gap-2">
        {/* Like / Dislike pill */}
        <div className="flex shrink-0 items-center overflow-hidden rounded-full bg-[#272727]">
          <button type="button" className="flex items-center gap-1.5 px-3.5 py-2 text-white active:bg-[#3a3a3a]">
            <ThumbUpIcon width={18} height={18} />
            <span className="text-[12px] font-medium">
              {info.likeCount !== null ? formatCount(info.likeCount) : "Me gusta"}
            </span>
          </button>
          <div className="h-6 w-px bg-[#3a3a3a]" />
          <button type="button" className="px-3 py-2 text-white active:bg-[#3a3a3a]">
            <ThumbDownIcon width={18} height={18} />
          </button>
        </div>

        {/* Share */}
        <ShareButtonYT url={url} title={info.name} />

        {/* Download */}
        <DownloadButton info={info} />

        {/* Save */}
        <AddToPlaylistButton info={info} />

        {/* Comments pill */}
        <button
          type="button"
          onClick={onOpenComments}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#272727] px-3.5 py-2 text-white active:bg-[#3a3a3a]"
        >
          <CommentIcon width={18} height={18} />
          <span className="text-[12px] font-medium">Comentarios</span>
        </button>
      </div>
    </div>
  );
}

// ─── Comments Bottom Sheet Content ───────────────────────────────────────────

function CommentsSheetContent({ commentsData, hasError, url, serviceId, onRetry }: {
  readonly commentsData: CommentInfo | null;
  readonly hasError: boolean;
  readonly url: string;
  readonly serviceId: number;
  readonly onRetry: () => void;
}) {
  const [comments, setComments] = useState<readonly CommentItem[]>([]);
  const [nextPage, setNextPage] = useState<Page | null>(null);
  const [commentsCount, setCommentsCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sync from shared data when it arrives
  useEffect(() => {
    if (commentsData) {
      setComments(commentsData.items);
      setNextPage(commentsData.nextPage);
      setCommentsCount(commentsData.commentsCount);
    }
  }, [commentsData]);

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchCommentsNextPage(serviceId, url, nextPage);
      setComments((prev) => [...prev, ...data.items]);
      setNextPage(data.nextPage);
    } catch { /* swallow */ }
    finally { setLoadingMore(false); }
  }, [nextPage, loadingMore, serviceId, url]);

  // Loading state
  if (!commentsData && !hasError) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
      </div>
    );
  }

  if (commentsData?.isCommentsDisabled) {
    return <p className="px-4 py-8 text-center text-sm text-[#aaa]">Comentarios desactivados</p>;
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8">
        <p className="text-sm text-[#ff4444]">Error al cargar comentarios</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-[#272727] px-5 py-2 text-xs font-medium text-white active:bg-[#3a3a3a]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (comments.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-[#aaa]">Aún no hay comentarios</p>;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {commentsCount !== null && (
        <p className="text-[13px] text-[#aaa]">{formatCount(commentsCount)} comentarios</p>
      )}
      {comments.map((comment) => (
        <CommentCardYT key={comment.commentId} comment={comment} serviceId={serviceId} videoUrl={url} />
      ))}
      {nextPage && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mx-auto rounded-full bg-[#272727] px-6 py-2.5 text-xs font-medium text-[#f1f1f1] active:bg-[#3a3a3a] disabled:opacity-50"
        >
          {loadingMore ? "Cargando..." : "Mostrar más"}
        </button>
      )}
    </div>
  );
}

function CommentCardYT({ comment, serviceId, videoUrl }: {
  readonly comment: CommentItem;
  readonly serviceId: number;
  readonly videoUrl: string;
}) {
  const [replies, setReplies] = useState<readonly CommentItem[]>([]);
  const [repliesNextPage, setRepliesNextPage] = useState<Page | null>(null);
  const [showReplies, setShowReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const hasReplies = comment.replies !== null && comment.replyCount !== null && comment.replyCount > 0;

  const loadReplies = useCallback(async () => {
    const page = repliesNextPage ?? comment.replies;
    if (!page || loadingReplies) return;
    setLoadingReplies(true);
    try {
      const data = await fetchCommentsNextPage(serviceId, videoUrl, page);
      setReplies((prev) => [...prev, ...data.items]);
      setRepliesNextPage(data.nextPage);
    } catch { /* swallow */ }
    finally { setLoadingReplies(false); }
  }, [repliesNextPage, comment.replies, loadingReplies, serviceId, videoUrl]);

  function handleToggleReplies() {
    if (!showReplies && replies.length === 0) {
      setShowReplies(true);
      loadReplies();
    } else {
      setShowReplies(!showReplies);
    }
  }

  return (
    <div className="flex gap-3">
      {comment.uploaderAvatars[0]?.url ? (
        <RetryImage src={comment.uploaderAvatars[0].url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="h-9 w-9 shrink-0 rounded-full bg-[#333]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[#f1f1f1]">
            {comment.uploaderName}
          </span>
          {comment.textualUploadDate && (
            <span className="text-[11px] text-[#717171]">{comment.textualUploadDate}</span>
          )}
          {comment.pinned && (
            <span className="text-[10px] text-[#3ea6ff]">📌 Fijado</span>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[#f1f1f1]">{comment.commentText}</p>
        <div className="mt-2 flex items-center gap-4">
          {comment.likeCount !== null && comment.likeCount > 0 && (
            <div className="flex items-center gap-1 text-[#aaa]">
              <ThumbUpIcon width={14} height={14} />
              <span className="text-[11px]">{formatCount(comment.likeCount)}</span>
            </div>
          )}
          <ThumbDownIcon width={14} height={14} className="text-[#aaa]" />
          {comment.heartedByUploader && <span className="text-[12px]">❤️</span>}
          {hasReplies && (
            <button
              type="button"
              onClick={handleToggleReplies}
              className="text-[12px] font-medium text-[#3ea6ff]"
            >
              {showReplies ? "Ocultar respuestas" : `${comment.replyCount} respuestas`}
            </button>
          )}
        </div>

        {/* Replies */}
        {showReplies && (
          <div className="mt-3 flex flex-col gap-3 pl-1">
            {replies.map((reply) => (
              <div key={reply.commentId} className="flex gap-2.5">
                {reply.uploaderAvatars[0]?.url ? (
                  <RetryImage src={reply.uploaderAvatars[0].url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 shrink-0 rounded-full bg-[#333]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#f1f1f1]">
                      {reply.uploaderName}
                    </span>
                    {reply.creatorReply && (
                      <span className="rounded bg-[#3ea6ff] px-1 py-0.5 text-[9px] font-semibold text-black">Creator</span>
                    )}
                    {reply.textualUploadDate && (
                      <span className="text-[10px] text-[#717171]">{reply.textualUploadDate}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#f1f1f1]">{reply.commentText}</p>
                  {reply.likeCount !== null && reply.likeCount > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-[#aaa]">
                      <ThumbUpIcon width={12} height={12} />
                      <span className="text-[10px]">{formatCount(reply.likeCount)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loadingReplies && (
              <div className="flex justify-center py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
              </div>
            )}
            {repliesNextPage && !loadingReplies && (
              <button
                type="button"
                onClick={loadReplies}
                className="text-left text-[12px] font-medium text-[#3ea6ff]"
              >
                Mostrar más respuestas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Share Button (YouTube pill style) ───────────────────────────────────────

function ShareButtonYT({ url, title }: { readonly url: string; readonly title: string }) {
  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* clipboard not available */ }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#272727] px-3.5 py-2 text-white active:bg-[#3a3a3a]"
    >
      <ShareIcon width={18} height={18} />
      <span className="text-[12px] font-medium">Compartir</span>
    </button>
  );
}

// ─── Comments Preview Card ───────────────────────────────────────────────────

function CommentsPreviewCard({ commentsData, hasError, onOpenComments }: {
  readonly commentsData: CommentInfo | null;
  readonly hasError: boolean;
  readonly onOpenComments: () => void;
}) {
  if (commentsData?.isCommentsDisabled) return null;

  const count = commentsData?.commentsCount ?? null;
  const topComment = commentsData?.items[0] ?? null;

  return (
    <button
      type="button"
      onClick={onOpenComments}
      className="mx-3 my-2 rounded-xl bg-[#1a1a1a] p-3 text-left active:bg-[#242424]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[14px] font-semibold text-white">
          Comentarios {count !== null && <span className="font-normal text-[#aaa]">{formatCount(count)}</span>}
        </span>
        <svg viewBox="0 0 24 24" width={18} height={18} fill="#aaa">
          <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </div>
      {topComment ? (
        <div className="flex items-start gap-2.5">
          {topComment.uploaderAvatars[0]?.url ? (
            <RetryImage src={topComment.uploaderAvatars[0].url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="h-6 w-6 shrink-0 rounded-full bg-[#333]" />
          )}
          <p className="line-clamp-2 text-[13px] leading-relaxed text-[#ddd]">{topComment.commentText}</p>
        </div>
      ) : hasError ? (
        <p className="text-[13px] text-[#ff4444]">Error al cargar. Toca para reintentar.</p>
      ) : (
        <p className="text-[13px] text-[#717171]">Toca para ver los comentarios</p>
      )}
    </button>
  );
}

// ─── Related Videos ──────────────────────────────────────────────────────────

function RelatedVideos({ info }: { readonly info: StreamInfo }) {
  return (
    <div className="pt-2">
      {info.relatedItems.map((item, i) => (
        <VideoCard key={`${item.url}-${i}`} item={item} />
      ))}
    </div>
  );
}

// ─── Add to Playlist Button (YouTube pill style) ─────────────────────────────

function AddToPlaylistButton({ info }: { readonly info: StreamInfo }) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Array<{ id: number; name: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function handleOpen() {
    const all = await database.playlists.toArray();
    setPlaylists(all.map((p) => ({ id: p.id as number, name: p.name })));
    setOpen(true);
    setMessage(null);
  }

  async function handleAdd(playlistId: number) {
    let existing = await database.streams.where("url").equals(info.url).first();
    if (!existing) {
      const id = await database.streams.add({
        serviceId: info.serviceId,
        url: info.url,
        title: info.name,
        streamType: info.streamType,
        duration: info.duration,
        uploader: info.uploaderName,
        uploaderUrl: info.uploaderUrl,
        thumbnailUrl: info.thumbnails[0]?.url ?? null,
        viewCount: info.viewCount,
        textualUploadDate: info.textualUploadDate,
        uploadDate: info.uploadDate,
        isUploadDateApproximation: false,
      });
      existing = await database.streams.get(id as number);
    }

    if (!existing?.id) return;

    const { addStreamToPlaylist } = await import("@/application/services/PersistenceService");
    await addStreamToPlaylist(playlistId, existing.id);
    setMessage("¡Añadido!");
    setTimeout(() => setOpen(false), 800);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-full bg-[#272727] px-3.5 py-2 text-white active:bg-[#3a3a3a]"
      >
        <SaveIcon width={18} height={18} />
        <span className="text-[12px] font-medium">Guardar</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 min-w-48 overflow-hidden rounded-xl bg-[#1a1a1a]/95 p-1 shadow-2xl backdrop-blur-md">
          {message ? (
            <p className="px-3 py-2 text-[12px] text-green-400">¡Añadido!</p>
          ) : playlists.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[#aaa]">Sin playlists</p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => handleAdd(pl.id)}
                className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#f1f1f1] active:bg-white/10"
              >
                {pl.name}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-0.5 w-full rounded-lg px-3 py-1.5 text-[11px] text-[#717171] active:bg-white/10"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Download Button (YouTube pill style) ────────────────────────────────────

function DownloadButton({ info }: { readonly info: StreamInfo }) {
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const streams = [
    ...info.videoStreams.filter((s) => !s.isVideoOnly).map((s) => ({
      label: `Video ${s.resolution}`,
      url: s.url,
      filename: `${sanitizeFilename(info.name)}_${s.resolution}.${getExtension(s.format?.toString())}`,
    })),
    ...info.audioStreams.map((s) => ({
      label: `Audio ${s.quality ?? `${s.averageBitrate}kbps`}`,
      url: s.url,
      filename: `${sanitizeFilename(info.name)}_audio.${getExtension(s.format?.toString())}`,
    })),
  ];

  if (streams.length === 0) return null;

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 rounded-full bg-[#272727] px-3.5 py-2 text-white active:bg-[#3a3a3a]"
      >
        <DownloadIcon width={18} height={18} />
        <span className="text-[12px] font-medium">Download</span>
      </button>

      {showMenu && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-[#212121] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-3">
              <div className="h-1 w-10 rounded-full bg-[#555]" />
            </div>
            <p className="px-5 pb-3 text-[15px] font-semibold text-white">Descargar</p>
            <div className="max-h-[60vh] overflow-y-auto pb-4">
              {streams.map((stream) => (
                <a
                  key={stream.url}
                  href={stream.url}
                  download={stream.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left text-[14px] text-white active:bg-white/5"
                >
                  <DownloadIcon width={18} height={18} />
                  <span>{stream.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

function getExtension(format: string | null | undefined): string {
  if (!format) return "mp4";
  const lower = format.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("m4a")) return "m4a";
  if (lower.includes("opus")) return "opus";
  if (lower.includes("3gpp")) return "3gp";
  return "mp4";
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M views`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}
