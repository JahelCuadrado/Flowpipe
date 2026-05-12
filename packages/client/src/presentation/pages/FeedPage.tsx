import { useState, useEffect, useCallback, useRef } from "react";
import { database } from "@/infrastructure/database/AppDatabase";
import { fetchChannelTabInfo } from "@/infrastructure/api/ApiService";
import { VideoCardGrid } from "@/presentation/components/ui/VideoCard";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { PullToRefresh } from "@/presentation/components/ui/PullToRefresh";
import type { StreamInfoItem } from "@newpipe/shared";
import type { SubscriptionEntity } from "@/domain/entities/LocalEntities";

const SUBS_PER_PAGE = 8;
const VIDEOS_PER_CHANNEL = 10;

/**
 * Feed page showing latest videos from subscribed channels.
 * Loads subscriptions in pages of SUBS_PER_PAGE to avoid overwhelming the server.
 */
export default function FeedPage() {
  const [items, setItems] = useState<StreamInfoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);
  const subsRef = useRef<SubscriptionEntity[]>([]);

  const fetchBatch = useCallback(async (page: number): Promise<StreamInfoItem[]> => {
    const start = page * SUBS_PER_PAGE;
    const batch = subsRef.current.slice(start, start + SUBS_PER_PAGE);
    if (batch.length === 0) return [];

    const batchItems: StreamInfoItem[] = [];
    const results = await Promise.allSettled(
      batch.map((sub) => fetchChannelTabInfo(sub.serviceId, sub.url, "Videos"))
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        batchItems.push(...result.value.items.slice(0, VIDEOS_PER_CHANNEL));
      }
    }
    return batchItems;
  }, []);

  const deduplicateAndSort = useCallback((allItems: StreamInfoItem[]): StreamInfoItem[] => {
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
    unique.sort((a, b) => {
      const dateA = a.uploadDate ?? a.textualUploadDate ?? "";
      const dateB = b.uploadDate ?? b.textualUploadDate ?? "";
      return dateB.localeCompare(dateA);
    });
    return unique;
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    pageRef.current = 0;

    const subs = await database.subscriptions.toArray();
    subsRef.current = subs;

    if (subs.length === 0) {
      setItems([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch ALL batches in parallel for maximum speed
      const totalBatches = Math.ceil(subs.length / SUBS_PER_PAGE);
      const batchPromises = Array.from({ length: totalBatches }, (_, i) => fetchBatch(i));
      const batchResults = await Promise.allSettled(batchPromises);

      const allItems: StreamInfoItem[] = [];
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          allItems.push(...result.value);
        }
      }

      setItems(deduplicateAndSort(allItems));
      pageRef.current = totalBatches;
      setHasMore(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [fetchBatch, deduplicateAndSort]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const batchItems = await fetchBatch(pageRef.current);
      if (batchItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => deduplicateAndSort([...prev, ...batchItems]));
        pageRef.current += 1;
        setHasMore(pageRef.current * SUBS_PER_PAGE < subsRef.current.length);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchBatch, deduplicateAndSort]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return (
    <PullToRefresh onRefresh={async () => { await loadInitial(); }}>
      <div className="pt-2">
        <h1 className="mb-3 px-4 text-[18px] font-bold text-[#f1f1f1]">
          Subscription Feed
        </h1>

        {loading && <LoadingScreen />}
        {error && !loading && <ErrorMessage message={error} onRetry={loadInitial} />}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-4xl">📡</span>
            <p className="text-sm text-[#aaa]">No videos in your feed</p>
            <p className="text-xs text-[#6b6b6b]">
              Subscribe to channels to see their latest videos here
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="flex flex-col">
            {items.map((item, i) => (
              <VideoCardGrid key={`${item.url}-${i}`} item={item} />
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mx-auto my-4 rounded-full bg-[#272727] px-6 py-2 text-xs font-medium text-[#f1f1f1] active:bg-[#3a3a3a] disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
