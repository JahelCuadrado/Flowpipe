import type { StreamType } from "@newpipe/shared";
import type { ServiceId } from "@newpipe/shared";

/**
  * Local stream entity stored in IndexedDB.
  * Mirrors the original Room StreamEntity.
  */
export interface StreamEntity {
  readonly id?: number;
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly title: string;
  readonly streamType: StreamType;
  readonly duration: number;
  readonly uploader: string;
  readonly uploaderUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly viewCount: number | null;
  readonly textualUploadDate: string | null;
  readonly uploadDate: string | null;
  readonly isUploadDateApproximation: boolean | null;
}

/**
  * Local subscription entity stored in IndexedDB.
  * Mirrors the original Room SubscriptionEntity.
  */
export interface SubscriptionEntity {
  readonly id?: number;
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly subscriberCount: number | null;
  readonly description: string | null;
  readonly notificationMode: number;
}

/**
  * Local playlist entity stored in IndexedDB.
  */
export interface PlaylistEntity {
  readonly id?: number;
  readonly name: string;
  readonly isThumbnailPermanent: boolean;
  readonly thumbnailStreamId: number;
  readonly displayIndex: number;
}

/**
  * Join table for playlist-stream relationships.
  */
export interface PlaylistStreamEntity {
  readonly id?: number;
  readonly playlistId: number;
  readonly streamId: number;
  readonly joinIndex: number;
}

/**
  * Stream history entry for tracking watch history.
  */
export interface StreamHistoryEntity {
  readonly id?: number;
  readonly streamId: number;
  readonly accessDate: string;
  readonly repeatCount: number;
}

/**
  * Stream playback state (resume position).
  */
export interface StreamStateEntity {
  readonly streamId: number;
  readonly progressMillis: number;
}

/**
  * Search history entry.
  */
export interface SearchHistoryEntry {
  readonly id?: number;
  readonly serviceId: ServiceId;
  readonly creationDate: string;
  readonly search: string;
}
