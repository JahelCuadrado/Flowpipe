import type { Page } from "@newpipe/shared";

/**
  * Represents a page of items returned by an extractor.
  * Generic container for paginated results.
  */
export interface InfoItemsPage<T> {
  readonly items: readonly T[];
  readonly nextPage: Page | null;
}

/**
  * Configuration for the HTTP client used by extractors.
  */
export interface DownloaderConfig {
  readonly userAgent: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly cookies?: Readonly<Record<string, string>>;
}

/**
  * Response from an HTTP request made by the downloader.
  */
export interface DownloaderResponse {
  readonly responseCode: number;
  readonly responseMessage: string;
  readonly responseHeaders: Readonly<Record<string, readonly string[]>>;
  readonly responseBody: string;
  readonly latestUrl: string;
}

/**
  * HTTP client interface used by all extractors.
  * Allows swapping implementations for testing or different environments.
  */
export interface Downloader {
  get(url: string, headers?: Record<string, string>): Promise<DownloaderResponse>;
  post(url: string, headers?: Record<string, string>, body?: string): Promise<DownloaderResponse>;
  head(url: string, headers?: Record<string, string>): Promise<DownloaderResponse>;
}
