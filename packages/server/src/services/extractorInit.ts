import { NewPipeExtractor, UndiciDownloader, YoutubeService } from "@newpipe/extractor";

/**
  * Initializes the NewPipeExtractor with the HTTP downloader
  * and registers all supported streaming services.
  */
export function initExtractor(): void {
  const downloader = new UndiciDownloader();
  NewPipeExtractor.init(downloader);

  // Register services — only YouTube for Phase 1
  NewPipeExtractor.registerService(new YoutubeService(downloader));
}
