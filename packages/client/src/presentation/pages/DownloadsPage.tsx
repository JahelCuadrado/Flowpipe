import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import type { StreamEntity } from "@/domain/entities/LocalEntities";

/**
 * Downloads page showing locally saved streams.
 * In PWA mode, downloads use the browser download mechanism.
 * In Capacitor mode, files are saved to device storage.
 */
export default function DownloadsPage() {
  const [streams, setStreams] = useState<StreamEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadStreams = useCallback(async () => {
    setLoading(true);
    // Show all saved streams (streams table acts as the download catalog)
    const all = await database.streams.toArray();
    setStreams(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-xl font-semibold text-[var(--color-text-primary)]">Downloads</h1>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        </div>
      )}

      {!loading && streams.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">📥</span>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No downloads yet
          </p>
          <p className="max-w-xs text-xs text-[var(--color-text-tertiary)]">
            Use the download button on any video to save it for offline playback.
          </p>
        </div>
      )}

      {!loading && streams.length > 0 && (
        <div className="flex flex-col gap-1">
          {streams.map((stream) => (
            <button
              key={stream.id}
              type="button"
              onClick={() => navigate(`/watch?url=${encodeURIComponent(stream.url)}`)}
              className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface)]">
                {stream.thumbnailUrl && (
                  <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-[var(--color-text-primary)]">
                  {stream.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                  {stream.uploader}
                </p>
                {stream.duration > 0 && (
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    {formatDuration(stream.duration)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
