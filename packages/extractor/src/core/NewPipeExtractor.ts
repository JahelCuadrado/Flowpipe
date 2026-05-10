import type { Downloader } from "./types.js";
import type { StreamingService } from "./StreamingService.js";
import { ServiceId } from "@newpipe/shared";

/**
  * Global entry point for the extractor library.
  * Manages registered services and the HTTP downloader.
  *
  * Mirrors org.schabi.newpipe.extractor.NewPipe.
  */
export class NewPipeExtractor {
  private static downloader: Downloader | null = null;
  private static readonly services = new Map<ServiceId, StreamingService>();

  /**
    * Initializes the extractor with a downloader implementation.
    * Must be called before using any extractor.
    */
  static init(downloader: Downloader): void {
    NewPipeExtractor.downloader = downloader;
  }

  /**
    * Returns the configured downloader.
    * @throws if init() has not been called.
    */
  static getDownloader(): Downloader {
    if (!NewPipeExtractor.downloader) {
      throw new Error(
        "NewPipeExtractor not initialized. Call NewPipeExtractor.init(downloader) first."
      );
    }
    return NewPipeExtractor.downloader;
  }

  /**
    * Registers a streaming service with the extractor.
    */
  static registerService(service: StreamingService): void {
    NewPipeExtractor.services.set(service.serviceId, service);
  }

  /**
    * Returns the service for a given ID.
    * @throws if the service is not registered.
    */
  static getService(serviceId: ServiceId): StreamingService {
    const service = NewPipeExtractor.services.get(serviceId);
    if (!service) {
      throw new Error(`Service with ID ${serviceId} is not registered.`);
    }
    return service;
  }

  /**
    * Returns all registered services.
    */
  static getServices(): readonly StreamingService[] {
    return Array.from(NewPipeExtractor.services.values());
  }

  /**
    * Attempts to identify which service a URL belongs to.
    */
  static getServiceByUrl(url: string): StreamingService | null {
    for (const service of NewPipeExtractor.services.values()) {
      if (service.matchesUrl(url)) {
        return service;
      }
    }
    return null;
  }
}
