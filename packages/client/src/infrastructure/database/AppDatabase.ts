import Dexie, { type EntityTable } from "dexie";
import type {
  StreamEntity,
  SubscriptionEntity,
  PlaylistEntity,
  PlaylistStreamEntity,
  StreamHistoryEntity,
  StreamStateEntity,
  SearchHistoryEntry,
} from "@/domain/entities/LocalEntities";

/**
  * Dexie database definition for the NewPipe Web app.
  * Mirrors the original Room AppDatabase schema (version 9).
  *
  * Schema notation:
  *  ++id   = auto-incrementing primary key
  *  &      = unique index
  *  [a+b]  = compound index
  */
class AppDatabase extends Dexie {
  streams!: EntityTable<StreamEntity, "id">;
  subscriptions!: EntityTable<SubscriptionEntity, "id">;
  playlists!: EntityTable<PlaylistEntity, "id">;
  playlistStreams!: EntityTable<PlaylistStreamEntity, "id">;
  streamHistory!: EntityTable<StreamHistoryEntity, "id">;
  streamStates!: EntityTable<StreamStateEntity, "streamId">;
  searchHistory!: EntityTable<SearchHistoryEntry, "id">;

  constructor() {
    super("NewPipeDB");

    this.version(1).stores({
      streams: "++id, &[serviceId+url], title, uploader, uploadDate",
      subscriptions: "++id, &[serviceId+url], name",
      playlists: "++id, name, displayIndex",
      playlistStreams: "++id, playlistId, streamId, [playlistId+joinIndex]",
      streamHistory: "++id, streamId, accessDate",
      streamStates: "streamId",
      searchHistory: "++id, serviceId, search, creationDate",
    });
  }
}

/**
  * Singleton database instance.
  * Using a single instance ensures connection pooling and consistency.
  */
export const database = new AppDatabase();
