import { useState, useEffect, useCallback, useRef } from "react";
import { fetchShortsContent, fetchKioskInfo } from "@/infrastructure/api/ApiService";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { VideoCardGrid } from "@/presentation/components/ui/VideoCard";
import type { StreamInfoItem } from "@newpipe/shared";

/**
 * YouTube Shorts page — vertical infinite scroll feed.
 * Loads shorts via search-based extraction.
 * Fallback: filters trending items by short duration.
 */
export default function ShortsPage() {
  const serviceId = useSettingsStore((s) => s.defaultServiceId);
  const [items, setItems] = useState<StreamInfoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadShorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Primary: search-based shorts extraction
      const shorts = await fetchShortsContent(serviceId);
      if (shorts.length > 0) {
        setItems([...shorts]);
        return;
      }

      // Fallback: filter trending by duration
      const data = await fetchKioskInfo(serviceId, "Trending");
      const filtered = data.items.filter(
        (item) => item.duration > 0 && item.duration <= 60
      );
      setItems(filtered.length > 0 ? [...filtered] : [...data.items.slice(0, 20)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load shorts");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const moreShorts = await fetchShortsContent(serviceId);
      if (moreShorts.length > 0) {
        const existingUrls = new Set(items.map((i) => i.url));
        const newItems = moreShorts.filter((i) => !existingUrls.has(i.url));
        if (newItems.length > 0) {
          setItems((prev) => [...prev, ...newItems]);
        }
      }
    } catch {
      // Silently fail on load more
    } finally {
      setLoadingMore(false);
    }
  }, [serviceId, items, loadingMore]);

  useEffect(() => {
    loadShorts();
  }, [loadShorts]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, loadMore]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorMessage message={error} onRetry={loadShorts} />;

  return (
    <div className="pt-2">
      {/* Section header */}
      <div className="mb-2 flex items-center gap-2 px-4">
        <svg viewBox="0 0 24 24" width={24} height={24} fill="#f00">
          <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z" />
        </svg>
        <h1 className="text-[16px] font-bold text-[#f1f1f1]">Shorts</h1>
      </div>

      {/* Shorts feed — vertical scroll like Home */}
      <div className="flex flex-col">
        {items.map((item, i) => (
          <VideoCardGrid key={`${item.url}-${i}`} item={item} />
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-px" />

        {loadingMore && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
