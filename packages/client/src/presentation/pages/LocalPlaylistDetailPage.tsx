import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import type { PlaylistEntity, StreamEntity } from "@/domain/entities/LocalEntities";

export default function LocalPlaylistDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playlistId = Number(searchParams.get("id"));

  const [playlist, setPlaylist] = useState<PlaylistEntity | null>(null);
  const [streams, setStreams] = useState<StreamEntity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlaylist = useCallback(async () => {
    if (!playlistId) return;
    setLoading(true);
    const pl = await database.playlists.get(playlistId);
    setPlaylist(pl ?? null);

    if (pl) {
      const joins = await database.playlistStreams
        .where("playlistId")
        .equals(playlistId)
        .sortBy("joinIndex");

      const resolved: StreamEntity[] = [];
      for (const join of joins) {
        const stream = await database.streams.get(join.streamId);
        if (stream) resolved.push(stream);
      }
      setStreams(resolved);
    }
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const handleRemove = useCallback(async (streamId: number) => {
    await database.playlistStreams
      .where("[playlistId+joinIndex]")
      .between([playlistId, -Infinity], [playlistId, Infinity])
      .filter((ps) => ps.streamId === streamId)
      .delete();
    setStreams((prev) => prev.filter((s) => s.id !== streamId));
  }, [playlistId]);

  if (!playlistId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-text-secondary)]">No playlist ID provided</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-text-secondary)]">Playlist not found</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-primary)]">
        {playlist.name}
      </h1>
      <p className="mb-4 text-xs text-[var(--color-text-tertiary)]">{streams.length} videos</p>

      {streams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">📂</span>
          <p className="text-sm text-[var(--color-text-secondary)]">This playlist is empty</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Add videos from the video detail page
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {streams.map((stream) => (
            <div key={stream.id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--color-surface-hover)]">
              <button
                type="button"
                onClick={() => navigate(`/watch?url=${encodeURIComponent(stream.url)}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface)]">
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
                </div>
              </button>
              <button
                type="button"
                onClick={() => stream.id !== undefined && handleRemove(stream.id)}
                className="shrink-0 p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-primary)]"
                aria-label="Remove from playlist"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
