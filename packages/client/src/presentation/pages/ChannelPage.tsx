import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { fetchChannelInfo, fetchChannelTabInfo, fetchChannelTabNextPage } from "@/infrastructure/api/ApiService";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { useSubscription } from "@/application/hooks/useSubscription";
import { useAsync } from "@/application/hooks/useAsync";
import { VideoCard } from "@/presentation/components/ui/VideoCard";
import { ErrorMessage } from "@/presentation/components/ui/ErrorMessage";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import { SearchIcon } from "@/presentation/components/ui/Icons";
import type { StreamInfoItem, Page } from "@newpipe/shared";

const TAB_LABELS: Record<string, string> = {
  Videos: "Vídeos",
  Playlists: "Listas",
  Channels: "Canales",
  Livestreams: "En directo",
  Shorts: "Shorts",
};

export default function ChannelPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get("url") ?? "";
  const serviceId = useSettingsStore((s) => s.defaultServiceId);
  const [activeTab, setActiveTab] = useState("Videos");

  // Tab pagination state
  const [tabItems, setTabItems] = useState<readonly StreamInfoItem[]>([]);
  const [tabNextPage, setTabNextPage] = useState<Page | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: channel, loading, error, refetch } = useAsync(
    () => (url ? fetchChannelInfo(serviceId, url) : Promise.resolve(null)),
    [url, serviceId]
  );

  const { data: tabData, loading: tabLoading } = useAsync(
    () => {
      if (!url || !channel) return Promise.resolve(null);
      return fetchChannelTabInfo(serviceId, url, activeTab).then((info) => {
        setTabItems(info.items);
        setTabNextPage(info.nextPage);
        return info;
      });
    },
    [url, serviceId, activeTab, channel?.url]
  );

  const loadMore = useCallback(async () => {
    if (!tabNextPage || loadingMore || !url) return;
    setLoadingMore(true);
    try {
      const info = await fetchChannelTabNextPage(serviceId, url, activeTab, tabNextPage);
      setTabItems((prev) => [...prev, ...info.items]);
      setTabNextPage(info.nextPage);
    } catch { /* swallow */ }
    finally { setLoadingMore(false); }
  }, [tabNextPage, loadingMore, url, serviceId, activeTab]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !tabNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tabNextPage, loadMore]);

  if (!url) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#aaa]">No se proporcionó URL del canal</p>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!channel) return null;

  const banner = channel.banners[0]?.url;
  const avatar = channel.avatars[channel.avatars.length - 1]?.url ?? channel.avatars[0]?.url;

  return (
    <div className="flex min-h-full flex-col bg-[#0f0f0f]">
      {/* ── Top bar (back + search + more) ─── */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 pt-3">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full bg-black/40 p-1.5 text-white">
          <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <div className="flex gap-2">
          <button type="button" className="rounded-full bg-black/40 p-1.5 text-white">
            <SearchIcon width={20} height={20} />
          </button>
          <button type="button" className="rounded-full bg-black/40 p-1.5 text-white">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Banner ─── */}
      {banner ? (
        <div className="aspect-[3/1] w-full overflow-hidden bg-[#181818]">
          <img src={banner} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-16" />
      )}

      {/* ── Channel info ─── */}
      <ChannelHeader serviceId={serviceId} channel={channel} avatar={avatar} />

      {/* ── Description ─── */}
      {channel.description && (
        <p className="line-clamp-2 px-4 pb-3 text-[12px] leading-relaxed text-[#aaa]">
          {channel.description}
        </p>
      )}

      {/* ── Subscribe / Join buttons ─── */}
      <ChannelActions serviceId={serviceId} channel={channel} avatar={avatar} />

      {/* ── Tabs ─── */}
      <div className="mt-2 overflow-x-auto border-b border-[#272727] scrollbar-none">
        <div className="flex">
          {channel.tabs.map((tab) => (
            <button
              key={tab.name}
              type="button"
              onClick={() => setActiveTab(tab.name)}
              className={`shrink-0 border-b-2 px-5 py-3 text-[13px] font-medium transition-colors ${
                activeTab === tab.name
                  ? "border-white text-white"
                  : "border-transparent text-[#aaa] active:text-white"
              }`}
            >
              {TAB_LABELS[tab.name] ?? tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─── */}
      <div className="flex flex-col">
        {tabLoading && <LoadingScreen />}

        {tabData && !tabLoading && tabItems.length === 0 && (
          <p className="py-12 text-center text-[13px] text-[#aaa]">
            No hay contenido en esta pestaña
          </p>
        )}

        {tabData && !tabLoading && tabItems.map((item, i) => (
          <VideoCard key={`${item.url}-${i}`} item={item} />
        ))}

        {/* Infinite scroll sentinel */}
        {tabNextPage && <div ref={sentinelRef} className="h-px" />}

        {loadingMore && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")} K`;
  }
  return String(count);
}

interface ChannelData {
  readonly name: string;
  readonly url: string;
  readonly verified: boolean;
  readonly subscriberCount: number | null;
  readonly avatars: readonly { readonly url: string }[];
  readonly description: string | null;
}

function ChannelHeader({ channel, avatar }: { readonly serviceId: number; readonly channel: ChannelData; readonly avatar: string | undefined }) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      {/* Avatar */}
      {avatar && (
        <img src={avatar} alt="" className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />
      )}

      {/* Name + handle + subs */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h1 className="truncate text-[22px] font-bold text-white">{channel.name}</h1>
          {channel.verified && (
            <svg viewBox="0 0 24 24" width={14} height={14} className="shrink-0 text-[#aaa]" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] text-[#aaa]">
          {channel.subscriberCount !== null && (
            <span>{formatCount(channel.subscriberCount)} de suscriptores</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelActions({ serviceId, channel, avatar }: { readonly serviceId: number; readonly channel: ChannelData; readonly avatar: string | undefined }) {
  const {
    isSubscribed,
    toggle: toggleSubscription,
  } = useSubscription(
    serviceId,
    channel.url,
    channel.name,
    avatar ?? null,
    channel.subscriberCount,
    channel.description ?? null
  );

  return (
    <div className="flex gap-3 px-4">
      <button
        type="button"
        onClick={toggleSubscription}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors ${
          isSubscribed
            ? "bg-[#272727] text-[#aaa]"
            : "bg-white text-black"
        }`}
      >
        {isSubscribed && (
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
          </svg>
        )}
        {isSubscribed ? "Suscrito/a" : "Suscribirme"}
      </button>
    </div>
  );
}
