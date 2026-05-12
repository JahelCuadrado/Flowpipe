import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { fetchKioskInfo, fetchKioskNextPage, fetchSearch, fetchSearchNextPage } from "@/infrastructure/api/ApiService";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { VideoCardGrid } from "@/presentation/components/ui/VideoCard";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import { PullToRefresh } from "@/presentation/components/ui/PullToRefresh";
import { SearchIcon } from "@/presentation/components/ui/Icons";
import type { StreamInfoItem, Page } from "@newpipe/shared";

/**
 * Category chips with their corresponding search query for filtering.
 * The first entry (query: null) shows the default trending feed.
 */
const CATEGORY_CHIPS: readonly { readonly key: string; readonly label: string; readonly query: string | null }[] = [
  { key: "all", label: "Todo", query: null },
  { key: "gaming", label: "Videojuegos", query: "gaming" },
  { key: "music", label: "Música", query: "music" },
  { key: "news", label: "Noticias", query: "news" },
  { key: "live", label: "En directo", query: "live" },
  { key: "education", label: "Aprendizaje", query: "education tutorial" },
  { key: "sports", label: "Deportes", query: "sports" },
  { key: "podcasts", label: "Pódcasts", query: "podcast" },
  { key: "entertainment", label: "Entretenimiento", query: "entertainment" },
];

export default function HomePage() {
  const serviceId = useSettingsStore((s) => s.defaultServiceId);
  const navigate = useNavigate();

  const [items, setItems] = useState<readonly StreamInfoItem[]>([]);
  const [nextPage, setNextPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const chip = CATEGORY_CHIPS[activeChip];
      if (chip && chip.query) {
        // Category chip selected → search for that category
        const result = await fetchSearch(serviceId, chip.query, "Videos");
        setItems(result.items.filter((it): it is StreamInfoItem => "streamType" in it));
        setNextPage(result.nextPage);
      } else {
        // "Todo" → default trending feed
        const data = await fetchKioskInfo(serviceId, "Trending");
        setItems(data.items);
        setNextPage(data.nextPage);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [serviceId, activeChip]);

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const chip = CATEGORY_CHIPS[activeChip];
      if (chip && chip.query) {
        // Category search pagination
        const result = await fetchSearchNextPage(serviceId, chip.query, nextPage, "Videos");
        const streamItems = result.items.filter((it): it is StreamInfoItem => "streamType" in it);
        setItems((prev) => [...prev, ...streamItems]);
        setNextPage(result.nextPage);
      } else {
        // Trending kiosk pagination
        const data = await fetchKioskNextPage(serviceId, "Trending", nextPage);
        setItems((prev) => [...prev, ...data.items]);
        setNextPage(data.nextPage);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [serviceId, nextPage, loadingMore, activeChip]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextPage) return;

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
  }, [nextPage, loadMore]);

  async function handleRefresh() {
    await loadInitial();
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {/* ── YouTube Header ─── */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f0f0f] px-4 pb-2 pt-2">
        {/* Flowpipe Logo */}
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" width={32} height={32}>
            <path d="M6 7 Q6 4, 8.5 5.5 L16.5 10.5 Q19 12, 16.5 13.5 L8.5 18.5 Q6 20, 6 17 Z" fill="#ff0000" />
          </svg>
          <span className="text-[24px] font-bold tracking-tight text-white">Flowpipe</span>
        </div>

        {/* Right action */}
        <button
          type="button"
          className="text-white"
          aria-label="Search"
          onClick={() => navigate("/search")}
        >
          <SearchIcon width={26} height={26} />
        </button>
      </header>

      {/* ── Category chips (horizontal scroll) ─── */}
      <div className="sticky top-[44px] z-20 overflow-x-auto bg-[#0f0f0f] px-3 py-1.5 scrollbar-none">
        <div className="flex gap-2">
          {CATEGORY_CHIPS.map((chip, index) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveChip(index)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                index === activeChip
                  ? "bg-white text-black"
                  : "bg-[#272727] text-[#f1f1f1] active:bg-[#3a3a3a]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Video feed ─── */}
      {loading && !items.length && <LoadingScreen />}
      {error && !loading && <ErrorMessage message={error} onRetry={loadInitial} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-12 text-center text-sm text-[#aaa]">
          No trending content available
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="flex flex-col">
          {items.map((item, i) => (
            <VideoCardGrid key={`${item.url}-${i}`} item={item} />
          ))}

          {/* Infinite scroll sentinel */}
          {nextPage && <div ref={sentinelRef} className="h-px" />}

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
            </div>
          )}
        </div>
      )}
    </PullToRefresh>
  );
}
