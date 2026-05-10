export { NewPipeExtractor } from "./core/NewPipeExtractor.js";
export type { StreamingService } from "./core/StreamingService.js";
export type { Downloader, DownloaderConfig, DownloaderResponse, InfoItemsPage } from "./core/types.js";
export {
  ExtractionError,
  ContentNotAvailableError,
  AgeRestrictedContentError,
  GeoRestrictedContentError,
  ParsingError,
  ReCaptchaError,
} from "./core/errors.js";

export { UndiciDownloader } from "./utils/UndiciDownloader.js";
export { FetchDownloader } from "./utils/FetchDownloader.js";
export { YoutubeService } from "./services/youtube/YoutubeService.js";
