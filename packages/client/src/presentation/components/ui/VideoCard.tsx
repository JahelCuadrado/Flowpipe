import { useRef } from "react";
import { useNavigate } from "react-router";
import { MoreVertIcon } from "@/presentation/components/ui/Icons";
import { RetryImage } from "@/presentation/components/ui/RetryImage";
import { useVideoNavigation, getReverseTransitionUrl, clearReverseTransitionUrl } from "@/presentation/hooks/useVideoNavigation";
import type { StreamInfoItem } from "@newpipe/shared";

interface VideoCardProps {
  readonly item: StreamInfoItem;
}

/**
 * YouTube-style list video card (horizontal layout).
 * Used in feeds, search results, related videos.
 */
export function VideoCard({ item }: VideoCardProps) {
  const navigateToVideo = useVideoNavigation();
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const thumbnail = item.thumbnails[item.thumbnails.length - 1]?.url ?? item.thumbnails[0]?.url ?? "";
  const duration = formatDuration(item.duration);

  function handleClick() {
    navigateToVideo(item, thumbnailRef.current);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full gap-2.5 p-2 text-left active:bg-white/5"
    >
      {/* Thumbnail */}
      <div
        ref={(el) => {
          (thumbnailRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          // Assign transition name if this card is the target of a reverse transition
          if (el && getReverseTransitionUrl() === item.url) {
            el.style.viewTransitionName = "hero-thumbnail";
            requestAnimationFrame(() => clearReverseTransitionUrl());
          }
        }}
        className="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]"
      >
        {thumbnail && (
          <RetryImage src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {item.duration > 0 && (
          <span className="absolute bottom-1 right-1 rounded-[4px] bg-black/80 px-1 py-[1px] text-[11px] font-medium leading-tight text-white">
            {duration}
          </span>
        )}
        {item.duration < 0 && (
          <span className="absolute bottom-1 right-1 rounded-[4px] bg-[#cc0000] px-1 py-[1px] text-[11px] font-medium leading-tight text-white">
            EN DIRECTO
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col pt-0.5">
        <h3 className="line-clamp-2 text-[13px] font-normal leading-[18px] text-[#f1f1f1]">
          {item.name}
        </h3>
        <div className="mt-auto flex flex-col gap-0">
          <p className="truncate text-[12px] leading-[18px] text-[#aaa]">
            {item.uploaderName}
            {item.uploaderVerified && (
              <span className="ml-1 inline-block align-middle text-[10px] text-[#aaa]">✓</span>
            )}
          </p>
          <p className="flex items-center gap-1 text-[12px] leading-[18px] text-[#aaa]">
            {item.viewCount !== null && item.viewCount !== undefined && (
              <>
                <PlayTriangleIcon />
                <span>{formatViewCount(item.viewCount)}</span>
              </>
            )}
            {item.viewCount != null && (item.textualUploadDate || item.uploadDate) && (
              <span> · </span>
            )}
            {(item.textualUploadDate || item.uploadDate) && (
              <span>{formatCompactDate(item.textualUploadDate, item.uploadDate)}</span>
            )}
          </p>
        </div>
      </div>

      {/* Three-dot menu */}
      <div className="shrink-0 pt-0.5 text-[#aaa]" onClick={(e) => e.stopPropagation()}>
        <MoreVertIcon width={20} height={20} />
      </div>
    </button>
  );
}

/**
 * YouTube-style grid video card (vertical layout with channel avatar).
 * Used in Home page, trending, channel videos.
 */
export function VideoCardGrid({ item }: VideoCardProps) {
  const navigateToVideo = useVideoNavigation();
  const navigate = useNavigate();
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const thumbnail = item.thumbnails[item.thumbnails.length - 1]?.url ?? item.thumbnails[0]?.url ?? "";
  const duration = formatDuration(item.duration);
  const avatar = item.uploaderAvatars?.[0]?.url ?? null;

  function handleClick() {
    navigateToVideo(item, thumbnailRef.current);
  }

  function handleChannelClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (item.uploaderUrl) {
      navigate(`/channel?url=${encodeURIComponent(item.uploaderUrl)}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full flex-col text-left active:bg-white/5"
    >
      {/* Thumbnail — full width, 16:9 */}
      <div
        ref={(el) => {
          (thumbnailRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (el && getReverseTransitionUrl() === item.url) {
            el.style.viewTransitionName = "hero-thumbnail";
            requestAnimationFrame(() => clearReverseTransitionUrl());
          }
        }}
        className="relative mx-3 mt-1 aspect-video w-[calc(100%-24px)] overflow-hidden rounded-lg bg-[#1a1a1a]"
      >
        {thumbnail && (
          <RetryImage src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {item.duration > 0 && (
          <span className="absolute bottom-2 right-2 rounded-[4px] bg-black/80 px-1 py-[1px] text-[12px] font-medium leading-tight text-white">
            {duration}
          </span>
        )}
        {item.duration < 0 && (
          <span className="absolute bottom-2 right-2 rounded-[4px] bg-[#cc0000] px-1 py-[1px] text-[12px] font-medium leading-tight text-white">
            EN DIRECTO
          </span>
        )}
      </div>

      {/* Channel avatar + info row */}
      <div className="flex gap-3 px-3 py-2.5">
        {/* Avatar */}
        <div
          className="mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#333]"
          onClick={handleChannelClick}
        >
          {avatar && (
            <RetryImage src={avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-normal leading-[20px] text-[#f1f1f1]">
            {item.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] leading-[16px] text-[#aaa]">
            <span className="truncate">{item.uploaderName}</span>
            {item.uploaderVerified && (
              <span className="shrink-0 text-[10px] text-[#aaa]">✓</span>
            )}
            {item.viewCount !== null && item.viewCount !== undefined && (
              <>
                <span className="shrink-0">·</span>
                <PlayTriangleIcon />
                <span className="shrink-0">{formatViewCount(item.viewCount)}</span>
              </>
            )}
            {(item.textualUploadDate || item.uploadDate) && (
              <>
                <span className="shrink-0">·</span>
                <span className="shrink-0">{formatCompactDate(item.textualUploadDate, item.uploadDate)}</span>
              </>
            )}
          </p>
        </div>

        {/* Three-dot menu */}
        <div className="shrink-0 pt-1 text-[#aaa]" onClick={(e) => e.stopPropagation()}>
          <MoreVertIcon width={20} height={20} />
        </div>
      </div>
    </button>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 0) {
    return "LIVE";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1)} B`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)} M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)} K`;
  }
  return `${count}`;
}

/**
 * Tiny play triangle icon used inline with view counts.
 */
function PlayTriangleIcon() {
  return (
    <svg viewBox="0 0 10 12" width={8} height={10} fill="currentColor" className="shrink-0">
      <path d="M0 0v12l10-6z" />
    </svg>
  );
}

/**
 * Converts textualUploadDate ("2 months ago", "3 days ago"…) or ISO uploadDate
 * into compact format: "2m", "3d", "5h", "1y".
 */
function formatCompactDate(textual: string | null, isoDate: string | null): string {
  // Try parsing the ISO date first for precision
  if (isoDate) {
    const date = new Date(isoDate);
    if (!Number.isNaN(date.getTime())) {
      const diffMs = Date.now() - date.getTime();
      return formatMillisToCompact(diffMs);
    }
  }

  // Fallback: parse the textual date ("2 months ago", "hace 3 días", etc.)
  if (textual) {
    return parseTextualDate(textual);
  }

  return "";
}

function formatMillisToCompact(diffMs: number): string {
  const seconds = Math.floor(diffMs / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `hace ${years}a`;
  if (months > 0) return `hace ${months}m`;
  if (days > 0) return `hace ${days}d`;
  if (hours > 0) return `hace ${hours}h`;
  if (minutes > 0) return `hace ${minutes}min`;
  return "ahora";
}

const TEXTUAL_DATE_PATTERNS: readonly [RegExp, string][] = [
  // Full English
  [/(\d+)\s*year/i, "a"],
  [/(\d+)\s*month/i, "m"],
  [/(\d+)\s*week/i, "sem"],
  [/(\d+)\s*day/i, "d"],
  [/(\d+)\s*hour/i, "h"],
  [/(\d+)\s*minute/i, "min"],
  [/(\d+)\s*second/i, "s"],
  // Abbreviated English ("4y ago", "2mo ago", "3d ago", "5h ago")
  [/(\d+)\s*y(?:r)?(?:\s|$)/i, "a"],
  [/(\d+)\s*mo(?:\s|$)/i, "m"],
  [/(\d+)\s*w(?:\s|$)/i, "sem"],
  [/(\d+)\s*d(?:\s|$)/i, "d"],
  [/(\d+)\s*h(?:\s|$)/i, "h"],
  [/(\d+)\s*m(?:in)?(?:\s|$)/i, "min"],
  [/(\d+)\s*s(?:ec)?(?:\s|$)/i, "s"],
  // Spanish
  [/(\d+)\s*año/i, "a"],
  [/(\d+)\s*mes/i, "m"],
  [/(\d+)\s*semana/i, "sem"],
  [/(\d+)\s*día/i, "d"],
  [/(\d+)\s*hora/i, "h"],
  [/(\d+)\s*minuto/i, "min"],
  [/(\d+)\s*segundo/i, "s"],
];

function parseTextualDate(text: string): string {
  for (const [pattern, unit] of TEXTUAL_DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return `hace ${match[1]}${unit}`;
    }
  }
  // Couldn't parse — return original truncated
  return text.length > 12 ? text.slice(0, 12) : text;
}
