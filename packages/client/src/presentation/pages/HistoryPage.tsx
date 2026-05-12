import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import { RetryImage } from "@/presentation/components/ui/RetryImage";
import type { StreamEntity, StreamHistoryEntity } from "@/domain/entities/LocalEntities";

interface HistoryItem {
  readonly history: StreamHistoryEntity;
  readonly stream: StreamEntity;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const historyEntries = await database.streamHistory
      .orderBy("accessDate")
      .reverse()
      .limit(100)
      .toArray();

    const resolved: HistoryItem[] = [];
    for (const entry of historyEntries) {
      const stream = await database.streams.get(entry.streamId);
      if (stream) {
        resolved.push({ history: entry, stream });
      }
    }
    setItems(resolved);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClearHistory = useCallback(async () => {
    await database.streamHistory.clear();
    setItems([]);
  }, []);

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">History</h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🕐</span>
          <p className="text-sm text-[var(--color-text-secondary)]">No watch history</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Videos you watch will appear here
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-1">
          {items.map(({ history, stream }) => (
            <button
              key={history.id}
              type="button"
              onClick={() => navigate(`/watch?url=${encodeURIComponent(stream.url)}`)}
              className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface)]">
                {stream.thumbnailUrl && (
                  <RetryImage src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-[var(--color-text-primary)]">
                  {stream.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                  {stream.uploader}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                  {new Date(history.accessDate).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
