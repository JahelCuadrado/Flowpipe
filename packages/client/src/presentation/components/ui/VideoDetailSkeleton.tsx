import { RetryImage } from "@/presentation/components/ui/RetryImage";
import type { StreamInfoItem } from "@newpipe/shared";

interface VideoDetailSkeletonProps {
  readonly preloadData: StreamInfoItem;
}

/**
 * Skeleton layout for the video detail page.
 * Renders immediately with data from the video card (thumbnail, title,
 * uploader, views, duration) while the full StreamInfo loads in background.
 *
 * The thumbnail container has `view-transition-name: hero-thumbnail` to
 * receive the morph animation from the feed card's thumbnail.
 */
export function VideoDetailSkeleton({ preloadData }: VideoDetailSkeletonProps) {
  const thumbnail =
    preloadData.thumbnails[preloadData.thumbnails.length - 1]?.url
    ?? preloadData.thumbnails[0]?.url
    ?? "";
  const avatar = preloadData.uploaderAvatars?.[0]?.url ?? null;

  return (
    <div className="flex flex-col bg-[#0f0f0f]">
      {/* Player area — shows thumbnail as poster */}
      <div
        className="relative aspect-video w-full bg-black"
        style={{ viewTransitionName: "hero-thumbnail" }}
      >
        {thumbnail && (
          <RetryImage
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {/* Buffering spinner overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/30 border-t-white" />
        </div>
      </div>

      {/* Metadata — real data from card */}
      <div className="flex flex-col gap-2 px-3 py-2.5">
        {/* Title */}
        <h1 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#f1f1f1]">
          {preloadData.name}
        </h1>

        {/* View count + date */}
        <div className="flex items-center gap-1.5 text-xs text-[#aaa]">
          {preloadData.viewCount !== null && preloadData.viewCount !== undefined && (
            <span>{formatViewCount(preloadData.viewCount)}</span>
          )}
          {preloadData.textualUploadDate && (
            <>
              <span>·</span>
              <span>{preloadData.textualUploadDate}</span>
            </>
          )}
        </div>

        {/* Channel row — real avatar + name */}
        <div className="flex items-center gap-2.5 py-1">
          <div className="flex flex-1 items-center gap-2.5">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-[#333]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[13px] font-medium text-[#f1f1f1]">
                <span className="truncate">{preloadData.uploaderName}</span>
                {preloadData.uploaderVerified && (
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="#aaa" className="shrink-0">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                )}
              </p>
              {/* Subscriber count skeleton */}
              <div className="skeleton mt-1 h-3 w-24 rounded" />
            </div>
          </div>
          {/* Subscribe button skeleton */}
          <div className="skeleton h-9 w-24 shrink-0 rounded-full" />
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="border-b border-[#272727] px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="skeleton h-9 w-28 rounded-full" />
          <div className="skeleton h-9 w-24 rounded-full" />
          <div className="skeleton h-9 w-24 rounded-full" />
          <div className="skeleton h-9 w-20 rounded-full" />
        </div>
      </div>

      {/* Comments preview skeleton */}
      <div className="mx-3 mt-3 rounded-xl bg-[#272727] p-3">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3.5 w-24 rounded" />
        </div>
        <div className="mt-2.5 flex gap-2">
          <div className="skeleton h-6 w-6 shrink-0 rounded-full" />
          <div className="flex-1">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton mt-1.5 h-3 w-3/4 rounded" />
          </div>
        </div>
      </div>

      {/* Related videos skeleton */}
      <div className="mt-3 flex flex-col gap-2 px-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex gap-2.5 p-2">
            <div className="skeleton aspect-video w-[168px] shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              <div className="skeleton h-3.5 w-full rounded" />
              <div className="skeleton h-3.5 w-3/4 rounded" />
              <div className="skeleton mt-auto h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)} B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)} M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)} K`;
  return `${count}`;
}
