import { NewPipeExtractor, FetchDownloader, YoutubeService } from "@newpipe/extractor";

let initialized = false;

/**
 * CORS proxy URL for browser development.
 * In production (Capacitor APK), Capacitor's native HTTP bypasses CORS.
 * Set VITE_CORS_PROXY_URL in .env.development for browser dev mode.
 */
const CORS_PROXY_URL = import.meta.env["VITE_CORS_PROXY_URL"] as string | undefined;

/**
 * Initializes the NewPipeExtractor with the Fetch-based downloader
 * and registers all supported streaming services.
 * Safe to call multiple times — only runs once.
 */
export function initExtractor(): void {
  if (initialized) {
    return;
  }

  const downloader = new FetchDownloader(
    undefined,
    undefined,
    CORS_PROXY_URL ?? null
  );

  NewPipeExtractor.init(downloader);
  NewPipeExtractor.registerService(new YoutubeService(downloader));

  initialized = true;
}
