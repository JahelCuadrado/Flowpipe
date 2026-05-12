import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { fetchSearch, fetchSearchNextPage, fetchSuggestions } from "@/infrastructure/api/ApiService";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { recordSearchQuery } from "@/application/services/PersistenceService";
import { database } from "@/infrastructure/database/AppDatabase";
import { VideoCard } from "@/presentation/components/ui/VideoCard";
import { ChannelCard } from "@/presentation/components/ui/ChannelCard";
import { PlaylistCard } from "@/presentation/components/ui/PlaylistCard";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import { SearchIcon } from "@/presentation/components/ui/Icons";
import type { SearchResultItem, Page } from "@newpipe/shared";

const CONTENT_FILTERS = ["", "Videos", "Channels", "Playlists", "Music songs"] as const;
const CONTENT_FILTER_LABELS: Record<string, string> = {
  "": "Todo",
  "Videos": "Vídeos",
  "Channels": "Canales",
  "Playlists": "Playlists",
  "Music songs": "Música",
};

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get("q") ?? "";
  const [inputValue, setInputValue] = useState(queryParam);
  const [query, setQuery] = useState(queryParam);
  const [contentFilter, setContentFilter] = useState("");
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [searchHistoryItems, setSearchHistoryItems] = useState<readonly string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(!queryParam);

  // Pagination state
  const [items, setItems] = useState<readonly SearchResultItem[]>([]);
  const [nextPage, setNextPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ suggestion: string | null; corrected: boolean }>({ suggestion: null, corrected: false });

  const serviceId = useSettingsStore((s) => s.defaultServiceId);
  const showSearchHistory = useSettingsStore((s) => s.showSearchHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const skipUrlSyncRef = useRef(false);

  // Initial search
  const executeSearch = useCallback(async (q: string, filter: string) => {
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSearch(serviceId, q, filter || undefined);
      setItems(result.items);
      setNextPage(result.nextPage);
      setSearchMeta({ suggestion: result.searchSuggestion, corrected: result.isCorrectedSearch });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
      setItems([]);
      setNextPage(null);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  // Load more pages
  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore || !query) return;
    setLoadingMore(true);
    try {
      const result = await fetchSearchNextPage(serviceId, query, nextPage, contentFilter || undefined);
      setItems((prev) => [...prev, ...result.items]);
      setNextPage(result.nextPage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextPage, loadingMore, query, serviceId, contentFilter]);

  // Trigger search when query or filter changes
  useEffect(() => {
    if (query) {
      executeSearch(query, contentFilter);
    } else {
      setItems([]);
      setNextPage(null);
    }
  }, [query, contentFilter, executeSearch]);

  // Infinite scroll
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

  // Fetch suggestions with debounce
  const fetchSuggestionsDebounced = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) { setSuggestions([]); return; }
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await fetchSuggestions(serviceId, value);
          setSuggestions(result);
        } catch { setSuggestions([]); }
      }, 200);
    },
    [serviceId]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSearchParams({ q: trimmed });
    setShowSuggestions(false);
    inputRef.current?.blur();
    if (showSearchHistory) recordSearchQuery(serviceId, trimmed).catch(() => {});
  }

  function handleSuggestionClick(suggestion: string) {
    setInputValue(suggestion);
    setQuery(suggestion);
    setSearchParams({ q: suggestion });
    setShowSuggestions(false);
    if (showSearchHistory) recordSearchQuery(serviceId, suggestion).catch(() => {});
  }

  /** Fill the input with the suggestion text (↗ arrow) without executing search */
  function handleFillSuggestion(e: React.MouseEvent, suggestion: string) {
    e.stopPropagation();
    e.preventDefault();
    setInputValue(suggestion);
    fetchSuggestionsDebounced(suggestion);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(true);
    fetchSuggestionsDebounced(value);
  }

  function handleClearInput() {
    skipUrlSyncRef.current = true;
    setInputValue("");
    setQuery("");
    setSearchParams({}, { replace: true });
    setSuggestions([]);
    setShowSuggestions(true);
    setItems([]);
    setError(null);
    inputRef.current?.focus();
  }

  const loadSearchHistory = useCallback(async () => {
    if (!showSearchHistory) return;
    const entries = await database.searchHistory.orderBy("creationDate").reverse().limit(8).toArray();
    setSearchHistoryItems(entries.map((e) => e.search));
  }, [showSearchHistory]);

  // Sync from URL changes (external navigation only, e.g. browser back/forward)
  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }
    const q = searchParams.get("q") ?? "";
    if (q && q !== query) { setQuery(q); setInputValue(q); }
  }, [searchParams, query]);

  // Auto-focus on mount
  useEffect(() => {
    if (!queryParam) {
      inputRef.current?.focus();
      loadSearchHistory();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestionList = suggestions.length > 0 ? suggestions : (searchHistoryItems.length > 0 && !inputValue.trim() ? searchHistoryItems : []);
  const isHistory = suggestions.length === 0 && searchHistoryItems.length > 0 && !inputValue.trim();

  return (
    <div className="flex min-h-full flex-col bg-[#0f0f0f]">
      {/* ── YouTube-style search bar ─── */}
      <header className="sticky top-0 z-40 flex items-center gap-2 bg-[#0f0f0f] px-2 pb-1 pt-3">
        {/* Back arrow */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="shrink-0 p-1.5 text-white"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center">
          <div className="relative flex min-w-0 flex-1 items-center rounded-full bg-[#1a1a1a] px-4 py-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => { setShowSuggestions(true); loadSearchHistory(); }}
              placeholder="Buscar en Flowpipe"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#717171]"
              autoComplete="off"
            />
            {inputValue && (
              <button type="button" onClick={handleClearInput} className="ml-2 shrink-0 text-[#aaa]">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                  <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </header>

      {/* ── Content filter chips (only when results shown) ─── */}
      {query && !showSuggestions && (
        <div className="overflow-x-auto bg-[#0f0f0f] px-3 py-1.5 scrollbar-none">
          <div className="flex gap-2">
            {CONTENT_FILTERS.map((f) => (
              <button
                key={f || "all"}
                type="button"
                onClick={() => setContentFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  contentFilter === f
                    ? "bg-white text-black"
                    : "bg-[#272727] text-[#f1f1f1] active:bg-[#3a3a3a]"
                }`}
              >
                {CONTENT_FILTER_LABELS[f] ?? f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Suggestions / History list ─── */}
      {showSuggestions && suggestionList.length > 0 && (
        <div className="flex flex-col">
          {suggestionList.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(s)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left active:bg-white/5"
            >
              {/* Icon */}
              <span className="shrink-0 text-[#aaa]">
                {isHistory ? (
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
                    <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                  </svg>
                ) : (
                  <SearchIcon width={20} height={20} />
                )}
              </span>

              {/* Text */}
              <span className="min-w-0 flex-1 truncate text-[15px] text-white">{s}</span>

              {/* Fill arrow ↗ */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleFillSuggestion(e, s)}
                className="shrink-0 p-1 text-[#aaa]"
                aria-label="Fill suggestion"
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                  <path d="M17.59 18.41 19 17l-6-6-6 6 1.41 1.41L12 14.83l5.59 5.58zM7 7h14v2H7z" transform="rotate(-45 12 12)" />
                </svg>
              </button>
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ─── */}
      {!query && !showSuggestions && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-[#717171]">Busca vídeos, canales y playlists</p>
        </div>
      )}

      {/* ── Results ─── */}
      {query && !showSuggestions && (
        <div className="flex flex-col px-0">
          {loading && <LoadingScreen />}
          {error && !loading && <ErrorMessage message={error} onRetry={() => executeSearch(query, contentFilter)} />}

          {!loading && !error && (
            <>
              {searchMeta.corrected && searchMeta.suggestion && (
                <p className="px-4 py-2 text-xs text-[#aaa]">
                  Mostrando resultados de <span className="font-medium text-white">{searchMeta.suggestion}</span>
                </p>
              )}

              {items.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#aaa]">
                  No se encontraron resultados para &quot;{query}&quot;
                </p>
              ) : (
                <>
                  {items.map((item, i) => (
                    <SearchResultCard key={`${item.url}-${i}`} item={item} />
                  ))}

                  {/* Infinite scroll sentinel */}
                  {nextPage && <div ref={sentinelRef} className="h-px" />}

                  {loadingMore && (
                    <div className="flex justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ item }: { readonly item: SearchResultItem }) {
  if ("streamType" in item) {
    return <VideoCard item={item} />;
  }
  if ("subscriberCount" in item) {
    return <ChannelCard item={item} />;
  }
  if ("streamCount" in item) {
    return <PlaylistCard item={item} />;
  }
  return null;
}
