import { useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { fetchPlaylistInfo, fetchPlaylistNextPage } from "@/infrastructure/api/ApiService";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { useAsync } from "@/application/hooks/useAsync";
import { VideoCard } from "@/presentation/components/ui/VideoCard";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import type { StreamInfoItem, Page } from "@newpipe/shared";

export default function PlaylistPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get("url") ?? "";
  const serviceId = useSettingsStore((s) => s.defaultServiceId);

  const [playlistItems, setPlaylistItems] = useState<readonly StreamInfoItem[]>([]);
  const [nextPage, setNextPage] = useState<Page | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, loading, error, refetch } = useAsync(
    () => {
      if (!url) return Promise.resolve(null);
      return fetchPlaylistInfo(serviceId, url).then((info) => {
        setPlaylistItems(info.items);
        setNextPage(info.nextPage);
        return info;
      });
    },
    [url, serviceId]
  );

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore || !url) return;
    setLoadingMore(true);
    try {
      const result = await fetchPlaylistNextPage(serviceId, url, nextPage);
      setPlaylistItems((prev) => [...prev, ...result.items]);
      setNextPage(result.nextPage);
    } catch { /* swallow */ }
    finally { setLoadingMore(false); }
  }, [nextPage, loadingMore, url, serviceId]);

  if (!url) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-text-secondary)]">No playlist URL provided</p>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const thumbnail = data.thumbnails[0]?.url;

  return (
    <div className="flex flex-col">
      {/* Playlist header */}
      <div className="bg-[var(--color-surface)] px-4 pb-4 pt-4">
        <div className="flex gap-4">
          {thumbnail && (
            <div className="aspect-video w-36 shrink-0 overflow-hidden rounded-lg">
              <img src={thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              {data.name}
            </h1>
            {data.uploaderName && (
              <button
                type="button"
                onClick={() => data.uploaderUrl && navigate(`/channel?url=${encodeURIComponent(data.uploaderUrl)}`)}
                className="truncate text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
              >
                {data.uploaderName}
              </button>
            )}
            {data.streamCount !== null && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {data.streamCount} videos
              </p>
            )}
          </div>
        </div>

        {data.description && (
          <p className="mt-3 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
            {data.description}
          </p>
        )}
      </div>

      {/* Items */}
      <div className="px-2 pt-2">
        {playlistItems.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
            This playlist is empty
          </p>
        ) : (
          <>
            {playlistItems.map((item, i) => (
              <VideoCard key={`${item.url}-${i}`} item={item} />
            ))}
            {nextPage && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mx-auto my-4 block rounded-full bg-[var(--color-surface)] px-6 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
