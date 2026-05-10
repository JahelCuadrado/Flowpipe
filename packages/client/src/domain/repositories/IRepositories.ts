import type {
  SubscriptionEntity,
  PlaylistEntity,
  PlaylistStreamEntity,
  StreamHistoryEntity,
  StreamStateEntity,
  SearchHistoryEntry,
  StreamEntity,
} from "../entities/LocalEntities";

/**
  * Repository interface for stream data persistence.
  * Abstracts IndexedDB access for testability.
  */
export interface IStreamRepository {
  upsert(stream: StreamEntity): Promise<number>;
  getById(id: number): Promise<StreamEntity | undefined>;
  getByUrl(serviceId: number, url: string): Promise<StreamEntity | undefined>;
  deleteById(id: number): Promise<void>;
}

/**
  * Repository interface for subscription management.
  */
export interface ISubscriptionRepository {
  getAll(): Promise<readonly SubscriptionEntity[]>;
  add(subscription: SubscriptionEntity): Promise<number>;
  remove(id: number): Promise<void>;
  getByUrl(serviceId: number, url: string): Promise<SubscriptionEntity | undefined>;
  updateNotificationMode(id: number, mode: number): Promise<void>;
}

/**
  * Repository interface for local playlist management.
  */
export interface IPlaylistRepository {
  getAll(): Promise<readonly PlaylistEntity[]>;
  create(playlist: PlaylistEntity): Promise<number>;
  delete(id: number): Promise<void>;
  rename(id: number, name: string): Promise<void>;
  getStreams(playlistId: number): Promise<readonly StreamEntity[]>;
  addStream(entry: PlaylistStreamEntity): Promise<void>;
  removeStream(playlistId: number, joinIndex: number): Promise<void>;
  reorderStreams(playlistId: number, entries: readonly PlaylistStreamEntity[]): Promise<void>;
}

/**
  * Repository interface for watch and search history.
  */
export interface IHistoryRepository {
  getStreamHistory(limit: number): Promise<readonly (StreamHistoryEntity & { stream: StreamEntity })[]>;
  addStreamHistory(entry: StreamHistoryEntity): Promise<void>;
  deleteStreamHistory(streamId: number): Promise<void>;
  clearStreamHistory(): Promise<void>;
  getSearchHistory(limit: number): Promise<readonly SearchHistoryEntry[]>;
  addSearchHistory(entry: SearchHistoryEntry): Promise<void>;
  deleteSearchHistory(id: number): Promise<void>;
  clearSearchHistory(): Promise<void>;
  getStreamState(streamId: number): Promise<StreamStateEntity | undefined>;
  upsertStreamState(state: StreamStateEntity): Promise<void>;
  deleteStreamState(streamId: number): Promise<void>;
}
