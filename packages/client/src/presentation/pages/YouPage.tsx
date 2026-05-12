import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import { SettingsIcon, SearchIcon } from "@/presentation/components/ui/Icons";
import type { StreamEntity, StreamHistoryEntity } from "@/domain/entities/LocalEntities";

interface HistoryItem {
  readonly history: StreamHistoryEntity;
  readonly stream: StreamEntity;
}

interface PlaylistItem {
  readonly id: number;
  readonly name: string;
  readonly thumbnailUrl: string | null;
  readonly streamCount: number;
}

/**
 * YouTube "You" tab — combines History, Playlists, Downloads
 * in a single scrollable page, matching YouTube mobile layout.
 */
export default function YouPage() {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Load recent history (last 10)
    const historyEntries = await database.streamHistory
      .orderBy("accessDate")
      .reverse()
      .limit(10)
      .toArray();

    const resolvedHistory: HistoryItem[] = [];
    for (const entry of historyEntries) {
      const stream = await database.streams.get(entry.streamId);
      if (stream) {
        resolvedHistory.push({ history: entry, stream });
      }
    }
    setHistoryItems(resolvedHistory);

    // Load playlists with first thumbnail
    const allPlaylists = await database.playlists.toArray();
    const playlistItems: PlaylistItem[] = [];
    for (const pl of allPlaylists) {
      const joinEntries = await database.playlistStreams
        .where("playlistId")
        .equals(pl.id as number)
        .toArray();
      let thumbnailUrl: string | null = null;
      if (joinEntries.length > 0) {
        const firstStream = await database.streams.get(joinEntries[0]!.streamId);
        thumbnailUrl = firstStream?.thumbnailUrl ?? null;
      }
      playlistItems.push({
        id: pl.id as number,
        name: pl.name,
        thumbnailUrl,
        streamCount: joinEntries.length,
      });
    }
    setPlaylists(playlistItems);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex flex-col bg-[#0f0f0f]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f0f0f] px-4 pb-2.5 pt-2.5">
        <h1 className="text-[24px] font-bold text-white">You</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-white"
            aria-label="Search"
            onClick={() => navigate("/search")}
          >
            <SearchIcon width={26} height={26} />
          </button>
          <button
            type="button"
            className="text-white"
            aria-label="Settings"
            onClick={() => navigate("/settings")}
          >
            <SettingsIcon width={26} height={26} />
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#aaa] border-t-transparent" />
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-6 pb-4">
          {/* ── Quick Actions Grid ── */}
          <div className="grid grid-cols-2 gap-1 px-3 pt-2">
            <QuickActionCard
              icon={
                <svg viewBox="0 0 24 24" width={24} height={24} fill="#f1f1f1">
                  <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                </svg>
              }
              label="History"
              onClick={() => navigate("/history")}
            />
            <QuickActionCard
              icon={
                <svg viewBox="0 0 24 24" width={24} height={24} fill="#f1f1f1">
                  <path d="M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-5z" />
                </svg>
              }
              label="Downloads"
              onClick={() => navigate("/downloads")}
            />
            <QuickActionCard
              icon={
                <svg viewBox="0 0 24 24" width={24} height={24} fill="#f1f1f1">
                  <path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H6V6h12v12zM9.5 13l2.5 3 3.5-4.5 4.5 6H4.5z" />
                </svg>
              }
              label="Your videos"
              onClick={() => navigate("/local-playlists")}
            />
            <QuickActionCard
              icon={
                <svg viewBox="0 0 24 24" width={24} height={24} fill="#f1f1f1">
                  <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
                </svg>
              }
              label="Your clips"
              onClick={() => navigate("/local-playlists")}
            />
          </div>

          {/* ── Recent History Section ── */}
          {historyItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between px-4 pb-2">
                <h2 className="text-base font-semibold text-[#f1f1f1]">History</h2>
                <button
                  type="button"
                  onClick={() => navigate("/history")}
                  className="text-[13px] font-medium text-[#3ea6ff]"
                >
                  View all
                </button>
              </div>
              <div className="overflow-x-auto px-3 scrollbar-none">
                <div className="flex gap-2.5">
                  {historyItems.map(({ history, stream }) => (
                    <button
                      key={history.id}
                      type="button"
                      onClick={() => navigate(`/watch?url=${encodeURIComponent(stream.url)}`)}
                      className="flex w-36 shrink-0 flex-col gap-1.5 text-left"
                    >
                      <div className="aspect-video w-full overflow-hidden rounded-lg bg-[#272727]">
                        {stream.thumbnailUrl && (
                          <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <p className="line-clamp-2 text-[12px] font-medium leading-tight text-[#f1f1f1]">
                        {stream.title}
                      </p>
                      <p className="truncate text-[11px] text-[#aaa]">{stream.uploader}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Playlists Section ── */}
          <section>
            <div className="flex items-center justify-between px-4 pb-2">
              <h2 className="text-base font-semibold text-[#f1f1f1]">Playlists</h2>
              <button
                type="button"
                onClick={() => navigate("/local-playlists")}
                className="text-[13px] font-medium text-[#3ea6ff]"
              >
                View all
              </button>
            </div>
            {playlists.length === 0 ? (
              <p className="px-4 text-sm text-[#aaa]">No playlists yet</p>
            ) : (
              <div className="flex flex-col gap-1 px-3">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => navigate(`/local-playlist?id=${pl.id}`)}
                    className="flex items-center gap-3 rounded-lg p-2 text-left active:bg-[#272727]"
                  >
                    <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-[#272727]">
                      {pl.thumbnailUrl && (
                        <img src={pl.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#f1f1f1]">{pl.name}</p>
                      <p className="text-[12px] text-[#aaa]">{pl.streamCount} videos</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function QuickActionCard({
  icon,
  label,
  onClick,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl bg-[#272727] px-4 py-3.5 text-left active:bg-[#333]"
    >
      {icon}
      <span className="text-[13px] font-medium text-[#f1f1f1]">{label}</span>
    </button>
  );
}
