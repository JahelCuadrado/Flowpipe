import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { database } from "@/infrastructure/database/AppDatabase";
import type { PlaylistEntity } from "@/domain/entities/LocalEntities";

export default function LocalPlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    const all = await database.playlists.orderBy("displayIndex").toArray();
    setPlaylists(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await database.playlists.add({
      name: trimmed,
      isThumbnailPermanent: false,
      thumbnailStreamId: -1,
      displayIndex: playlists.length,
    });
    setNewName("");
    setShowCreate(false);
    loadPlaylists();
  }, [newName, playlists.length, loadPlaylists]);

  const handleDelete = useCallback(async (id: number) => {
    await database.playlists.delete(id);
    await database.playlistStreams.where("playlistId").equals(id).delete();
    loadPlaylists();
  }, [loadPlaylists]);

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Playlists</h1>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          + New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Playlist name..."
            className="flex-1 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none ring-1 ring-[var(--color-border)] focus:ring-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white"
          >
            Create
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        </div>
      )}

      {!loading && playlists.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🎵</span>
          <p className="text-sm text-[var(--color-text-secondary)]">No playlists yet</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Create a playlist to organize your favorite videos
          </p>
        </div>
      )}

      {!loading && playlists.length > 0 && (
        <div className="flex flex-col gap-1">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <button
                type="button"
                onClick={() => navigate(`/local-playlist?id=${pl.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] text-lg">
                  🎵
                </div>
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {pl.name}
                </p>
              </button>
              <button
                type="button"
                onClick={() => pl.id !== undefined && handleDelete(pl.id)}
                className="shrink-0 p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-primary)]"
                aria-label="Delete playlist"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
