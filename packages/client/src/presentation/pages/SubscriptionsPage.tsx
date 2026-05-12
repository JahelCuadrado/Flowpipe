import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import { fetchChannelTabInfo, fetchChannelInfo } from "@/infrastructure/api/ApiService";
import { PullToRefresh } from "@/presentation/components/ui/PullToRefresh";
import { VideoCardGrid } from "@/presentation/components/ui/VideoCard";
import { RetryImage } from "@/presentation/components/ui/RetryImage";
import { SearchIcon } from "@/presentation/components/ui/Icons";
import type { SubscriptionEntity } from "@/domain/entities/LocalEntities";
import type { StreamInfoItem } from "@newpipe/shared";

const SUBS_PER_BATCH = 6;
const VIDEOS_PER_CHANNEL = 8;
/** Maximum batches to load on initial feed. Rest loads on scroll/demand. */
const MAX_INITIAL_BATCHES = 5;

/**
 * Fetches channel info for subscriptions that are missing an avatar
 * (e.g. imported from NewPipe) and updates them in the database.
 * Runs sequentially to avoid overwhelming the extractor.
 */
async function hydrateAvatars(subs: SubscriptionEntity[]): Promise<number> {
  let updated = 0;
  for (const sub of subs) {
    try {
      const info = await fetchChannelInfo(sub.serviceId, sub.url);
      const avatar = info.avatars?.[info.avatars.length - 1]?.url ?? null;
      if (avatar && sub.id !== undefined) {
        await database.subscriptions.update(sub.id, {
          avatarUrl: avatar,
          subscriberCount: info.subscriberCount ?? sub.subscriberCount,
          description: info.description ?? sub.description,
        });
        updated++;
      }
    } catch {
      // Skip failed channels — will retry on next visit
    }
  }
  return updated;
}

/**
 * Converts an ISO date string or relative text ("2 days ago", "hace 3 semanas")
 * into a Unix timestamp for chronological sorting.
 * Returns 0 for unparseable values (sorts them last).
 */
function estimateTimestamp(isoDate: string | null, relativeText: string | null): number {
  if (isoDate) {
    const ms = Date.parse(isoDate);
    if (!Number.isNaN(ms)) return ms;
  }
  if (!relativeText) return 0;

  const text = relativeText.toLowerCase();
  const match = text.match(/(\d+)/);
  if (!match) return 0;
  const amount = parseInt(match[1]!, 10);
  const now = Date.now();

  // English and Spanish relative date patterns
  if (/second|segundo/i.test(text)) return now - amount * 1_000;
  if (/minute|minuto/i.test(text)) return now - amount * 60_000;
  if (/hour|hora/i.test(text)) return now - amount * 3_600_000;
  if (/day|día|dia/i.test(text)) return now - amount * 86_400_000;
  if (/week|semana/i.test(text)) return now - amount * 604_800_000;
  if (/month|mes/i.test(text)) return now - amount * 2_592_000_000;
  if (/year|año/i.test(text)) return now - amount * 31_536_000_000;

  return 0;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntity[]>([]);
  const [feedItems, setFeedItems] = useState<StreamInfoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelVideos, setChannelVideos] = useState<StreamInfoItem[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(false);
  const navigate = useNavigate();
  const subsLoadedRef = useRef(false);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const subs = await database.subscriptions.orderBy("name").toArray();
      setSubscriptions(subs);
      setLoading(false);
      return subs;
    } catch {
      setLoading(false);
      return [];
    }
  }, []);

  const loadFeed = useCallback(async (subs: SubscriptionEntity[]) => {
    if (subs.length === 0) return;
    setLoadingFeed(true);
    try {
      // Build a lookup map for subscription avatars by channel URL
      const avatarByUrl = new Map<string, string>();
      for (const sub of subs) {
        if (sub.avatarUrl) avatarByUrl.set(sub.url, sub.avatarUrl);
      }

      // Split into batches
      const batches: SubscriptionEntity[][] = [];
      for (let i = 0; i < subs.length; i += SUBS_PER_BATCH) {
        batches.push(subs.slice(i, i + SUBS_PER_BATCH));
      }

      const accumulated: StreamInfoItem[] = [];
      const seenUrls = new Set<string>();
      const batchCount = Math.min(batches.length, MAX_INITIAL_BATCHES);

      // Process batches sequentially so we can render progressively
      for (let bIdx = 0; bIdx < batchCount; bIdx++) {
        const batch = batches[bIdx]!;
        const results = await Promise.allSettled(
          batch.map((sub) => fetchChannelTabInfo(sub.serviceId, sub.url, "Videos"))
        );

        for (let rIdx = 0; rIdx < results.length; rIdx++) {
          const result = results[rIdx]!;
          if (result.status !== "fulfilled" || !result.value) continue;
          const sub = batch[rIdx]!;
          const subAvatar = avatarByUrl.get(sub.url);
          const enrichedItems = result.value.items.slice(0, VIDEOS_PER_CHANNEL).map((item) => {
            const avatars = (item.uploaderAvatars.length === 0 && subAvatar)
              ? [{ url: subAvatar, width: 88, height: 88 }]
              : [...item.uploaderAvatars];
            return {
              ...item,
              uploaderAvatars: avatars,
              uploaderUrl: item.uploaderUrl || sub.url,
              uploaderName: item.uploaderName || sub.name,
            } as StreamInfoItem;
          });

          for (const item of enrichedItems) {
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              accumulated.push(item);
            }
          }
        }

        // Sort and render after each batch completes
        const sorted = [...accumulated].sort((a, b) => {
          const tsA = estimateTimestamp(a.uploadDate, a.textualUploadDate);
          const tsB = estimateTimestamp(b.uploadDate, b.textualUploadDate);
          return tsB - tsA;
        });
        setFeedItems(sorted);
      }
    } catch {
      // Feed loading failed silently
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    if (subsLoadedRef.current) return;
    subsLoadedRef.current = true;
    loadSubscriptions().then((subs) => {
      if (subs.length > 0) loadFeed(subs);
      // Hydrate avatars for subscriptions imported without one
      const missingAvatars = subs.filter((s) => !s.avatarUrl);
      if (missingAvatars.length > 0) {
        hydrateAvatars(missingAvatars).then((updated) => {
          if (updated > 0) loadSubscriptions();
        });
      }
    });
  }, [loadSubscriptions, loadFeed]);

  const filteredItems = selectedChannel
    ? feedItems.filter((item) => {
        const sub = subscriptions.find((s) => s.url === selectedChannel);
        // Match by exact URL, or by channel name when URLs use different formats
        return item.uploaderUrl === selectedChannel
          || (sub && item.uploaderName === sub.name);
      })
    : feedItems;

  // When a channel is selected but no feed items match, load directly from channel
  useEffect(() => {
    if (!selectedChannel) { setChannelVideos([]); return; }
    const sub = subscriptions.find((s) => s.url === selectedChannel);
    if (!sub) return;

    const feedMatch = feedItems.filter((item) => item.uploaderUrl === selectedChannel || item.uploaderName === sub.name);
    if (feedMatch.length > 0) { setChannelVideos([]); return; }

    setLoadingChannel(true);
    fetchChannelTabInfo(sub.serviceId, sub.url, "Videos")
      .then((result) => {
        if (result) setChannelVideos([...result.items]);
      })
      .catch(() => {})
      .finally(() => setLoadingChannel(false));
  }, [selectedChannel, subscriptions, feedItems]);

  const displayItems = selectedChannel && filteredItems.length === 0 ? channelVideos : filteredItems;

  async function handleRefresh() {
    const subs = await loadSubscriptions();
    await loadFeed(subs);
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f0f0f] px-4 pb-2.5 pt-2.5">
        <h1 className="text-[24px] font-bold text-white">Suscripciones</h1>
        <button
          type="button"
          className="text-white"
          aria-label="Search"
          onClick={() => navigate("/search")}
        >
          <SearchIcon width={26} height={26} />
        </button>
      </header>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
        </div>
      )}

      {!loading && subscriptions.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <svg viewBox="0 0 24 24" width={48} height={48} fill="#606060">
            <path d="M4 6h16v2H4zm2-4h12v2H6zm14 8H4v12h16V10zm-2 10H6v-8h12v8z" />
          </svg>
          <p className="text-sm text-[#aaa]">No subscriptions yet</p>
          <p className="text-xs text-[#717171]">Subscribe to channels to see their latest videos here</p>
        </div>
      )}

      {!loading && subscriptions.length > 0 && (
        <>
          {/* Channel avatars horizontal scroll */}
          <div
            className="sticky top-[46px] z-20 overflow-x-auto bg-[#0f0f0f] px-3 py-2.5 scrollbar-none"
          >
            <div className="flex gap-3">
              {/* "All" chip */}
              <button
                type="button"
                onClick={() => setSelectedChannel(null)}
                className={`flex shrink-0 flex-col items-center gap-1 ${
                  selectedChannel === null ? "opacity-100" : "opacity-60"
                }`}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  selectedChannel === null ? "bg-white" : "bg-[#272727]"
                }`}>
                  <span className={`text-[13px] font-semibold ${
                    selectedChannel === null ? "text-black" : "text-white"
                  }`}>All</span>
                </div>
              </button>

              {subscriptions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedChannel(
                    selectedChannel === sub.url ? null : sub.url
                  )}
                  className={`flex shrink-0 flex-col items-center gap-1 ${
                    selectedChannel === sub.url ? "opacity-100" : "opacity-60"
                  }`}
                >
                  <div className={`h-14 w-14 overflow-hidden rounded-full ring-2 ${
                    selectedChannel === sub.url ? "ring-white" : "ring-transparent"
                  }`}>
                    {sub.avatarUrl ? (
                      <RetryImage src={sub.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#333] text-xs font-semibold text-white">
                        {sub.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="max-w-14 truncate text-[10px] text-[#f1f1f1]">
                    {sub.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          {(loadingFeed || loadingChannel) && displayItems.length === 0 && (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
            </div>
          )}

          {!loadingFeed && !loadingChannel && displayItems.length === 0 && (
            <p className="py-12 text-center text-sm text-[#aaa]">
              {selectedChannel ? "No hay vídeos de este canal" : "No hay vídeos recientes"}
            </p>
          )}

          <div className="flex flex-col">
            {displayItems.map((item, i) => (
              <VideoCardGrid key={`${item.url}-${i}`} item={item} />
            ))}
          </div>
        </>
      )}
    </PullToRefresh>
  );
}
