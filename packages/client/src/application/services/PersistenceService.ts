import { database } from "@/infrastructure/database/AppDatabase";
import type { StreamInfo } from "@newpipe/shared";

/**
 * Persists a stream entity in Dexie and records a history entry.
 * Uses upsert semantics — updates if the stream URL already exists.
 */
export async function recordStreamView(info: StreamInfo): Promise<void> {
  const existing = await database.streams
    .where("[serviceId+url]")
    .equals([info.serviceId, info.url])
    .first();

  let streamId: number;

  if (existing && existing.id !== undefined) {
    streamId = existing.id;
    await database.streams.update(streamId, {
      title: info.name,
      duration: info.duration,
      uploader: info.uploaderName,
      uploaderUrl: info.uploaderUrl,
      thumbnailUrl: info.thumbnails[0]?.url ?? null,
      viewCount: info.viewCount,
      textualUploadDate: info.textualUploadDate,
      uploadDate: info.uploadDate,
    });
  } else {
    streamId = await database.streams.add({
      serviceId: info.serviceId,
      url: info.url,
      title: info.name,
      streamType: info.streamType,
      duration: info.duration,
      uploader: info.uploaderName,
      uploaderUrl: info.uploaderUrl,
      thumbnailUrl: info.thumbnails[0]?.url ?? null,
      viewCount: info.viewCount,
      textualUploadDate: info.textualUploadDate,
      uploadDate: info.uploadDate,
      isUploadDateApproximation: null,
    }) as number;
  }

  // Upsert history entry for today
  const today = new Date().toISOString();
  const existingHistory = await database.streamHistory
    .where("streamId")
    .equals(streamId)
    .last();

  if (existingHistory?.id !== undefined) {
    await database.streamHistory.update(existingHistory.id, {
      accessDate: today,
      repeatCount: existingHistory.repeatCount + 1,
    });
  } else {
    await database.streamHistory.add({
      streamId,
      accessDate: today,
      repeatCount: 1,
    });
  }
}

/**
 * Saves a search query to the Dexie searchHistory table.
 * Deduplicates by removing previous identical queries first.
 */
export async function recordSearchQuery(
  serviceId: number,
  query: string
): Promise<void> {
  // Remove duplicate
  const existing = await database.searchHistory
    .where("search")
    .equals(query)
    .filter((e) => e.serviceId === serviceId)
    .toArray();

  if (existing.length > 0) {
    const ids = existing
      .map((e) => e.id)
      .filter((id): id is number => id !== undefined);
    await database.searchHistory.bulkDelete(ids);
  }

  await database.searchHistory.add({
    serviceId,
    search: query,
    creationDate: new Date().toISOString(),
  });

  // Keep only 50 most recent entries
  const count = await database.searchHistory.count();
  if (count > 50) {
    const oldest = await database.searchHistory
      .orderBy("creationDate")
      .limit(count - 50)
      .toArray();
    const oldIds = oldest
      .map((e) => e.id)
      .filter((id): id is number => id !== undefined);
    await database.searchHistory.bulkDelete(oldIds);
  }
}

/**
 * Saves the playback progress for a stream in Dexie.
 */
export async function saveStreamState(
  streamId: number,
  progressMillis: number
): Promise<void> {
  await database.streamStates.put({ streamId, progressMillis });
}

/**
 * Adds a stream to a local playlist in Dexie.
 */
export async function addStreamToPlaylist(
  playlistId: number,
  streamId: number
): Promise<void> {
  const existing = await database.playlistStreams
    .where("playlistId")
    .equals(playlistId)
    .count();

  await database.playlistStreams.add({
    playlistId,
    streamId,
    joinIndex: existing,
  });
}

// ─── Import / Export Subscriptions ───────────────────────────────────────────

interface ExportedSubscription {
  readonly serviceId: number;
  readonly url: string;
  readonly name: string;
}

/**
 * Exports all subscriptions as a JSON blob and triggers a file download.
 */
export async function exportSubscriptions(): Promise<void> {
  const subs = await database.subscriptions.toArray();
  const exportData: ExportedSubscription[] = subs.map((s) => ({
    serviceId: s.serviceId,
    url: s.url,
    name: s.name,
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `newpipe-subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports subscriptions from a JSON file. Merges with existing (no duplicates).
 */
export async function importSubscriptions(file: File): Promise<number> {
  const text = await file.text();
  const data = JSON.parse(text) as ExportedSubscription[];

  if (!Array.isArray(data)) {
    throw new Error("Invalid subscription file format");
  }

  let imported = 0;

  for (const item of data) {
    if (!item.url || !item.name || item.serviceId === undefined) continue;

    const existing = await database.subscriptions
      .where("[serviceId+url]")
      .equals([item.serviceId, item.url])
      .first();

    if (!existing) {
      await database.subscriptions.add({
        serviceId: item.serviceId,
        url: item.url,
        name: item.name,
        avatarUrl: null,
        subscriberCount: null,
        description: null,
        notificationMode: 0,
      });
      imported++;
    }
  }

  return imported;
}
