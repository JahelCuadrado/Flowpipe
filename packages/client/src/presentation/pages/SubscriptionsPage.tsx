import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import { fetchChannelTabInfo } from "@/infrastructure/api/ApiService";
import { PullToRefresh } from "@/presentation/components/ui/PullToRefresh";
import { VideoCardGrid } from "@/presentation/components/ui/VideoCard";
import { SearchIcon } from "@/presentation/components/ui/Icons";
import type { SubscriptionEntity } from "@/domain/entities/LocalEntities";
import type { StreamInfoItem } from "@newpipe/shared";

const SUBS_PER_BATCH = 6;
const VIDEOS_PER_CHANNEL = 8;

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
    const subs = await database.subscriptions.orderBy("name").toArray();
    setSubscriptions(subs);
    setLoading(false);
    return subs;
  }, []);

  const loadFeed = useCallback(async (subs: SubscriptionEntity[]) => {
    if (subs.length === 0) return;
    setLoadingFeed(true);
    try {
      const allItems: StreamInfoItem[] = [];
      // Build a lookup map for subscription avatars by channel URL
      const avatarByUrl = new Map<string, string>();
      for (const sub of subs) {
        if (sub.avatarUrl) avatarByUrl.set(sub.url, sub.avatarUrl);
      }
      // Load in batches to avoid overwhelming the server
      for (let i = 0; i < subs.length; i += SUBS_PER_BATCH) {
        const batch = subs.slice(i, i + SUBS_PER_BATCH);
        const results = await Promise.allSettled(
          batch.map((sub) => fetchChannelTabInfo(sub.serviceId, sub.url, "Videos"))
        );
        for (let batchIdx = 0; batchIdx < results.length; batchIdx++) {
          const result = results[batchIdx]!;
          if (result.status === "fulfilled" && result.value) {
            const sub = batch[batchIdx]!;
            const subAvatar = avatarByUrl.get(sub.url);
            const enrichedItems = result.value.items.slice(0, VIDEOS_PER_CHANNEL).map((item) => {
              const patched = { ...item };
              // Inject subscription avatar when the extractor doesn't provide one
              if (item.uploaderAvatars.length === 0 && subAvatar) {
                (patched as Record<string, unknown>).uploaderAvatars = [{ url: subAvatar, width: 88, height: 88 }];
              }
              // Ensure uploaderUrl is set so channel filtering works reliably
              if (!item.uploaderUrl) {
                (patched as Record<string, unknown>).uploaderUrl = sub.url;
              }
              // Ensure uploaderName is set from the subscription
              if (!item.uploaderName) {
                (patched as Record<string, unknown>).uploaderName = sub.name;
              }
              return patched as StreamInfoItem;
            });
            allItems.push(...enrichedItems);
          }
        }
      }
      // Deduplicate + sort by date
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
      setFeedItems(unique);
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
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f0f0f] px-4 py-2.5">
        <h1 className="text-lg font-semibold text-white">Suscripciones</h1>
        <button
          type="button"
          className="text-white"
          aria-label="Search"
          onClick={() => navigate("/search")}
        >
          <SearchIcon width={22} height={22} />
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
            className="sticky top-[44px] z-20 overflow-x-auto bg-[#0f0f0f] px-3 py-2.5 scrollbar-none"
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
                      <img src={sub.avatarUrl} alt="" className="h-full w-full object-cover" />
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
