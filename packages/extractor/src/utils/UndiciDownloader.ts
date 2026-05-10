import type { Downloader, DownloaderResponse } from "../core/types.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0";

/**
 * @deprecated Use FetchDownloader instead.
 * This class now uses the Fetch API internally for backward compatibility.
 */
export class UndiciDownloader implements Downloader {
  private readonly defaultHeaders: Record<string, string>;

  constructor(userAgent?: string, extraHeaders?: Record<string, string>) {
    this.defaultHeaders = {
      "User-Agent": userAgent ?? DEFAULT_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      ...extraHeaders,
    };
  }

  async get(
    url: string,
    headers?: Record<string, string>
  ): Promise<DownloaderResponse> {
    return this.execute("GET", url, headers);
  }

  async post(
    url: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<DownloaderResponse> {
    return this.execute("POST", url, headers, body);
  }

  async head(
    url: string,
    headers?: Record<string, string>
  ): Promise<DownloaderResponse> {
    return this.execute("HEAD", url, headers);
  }

  private async execute(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<DownloaderResponse> {
    const response = await fetch(url, {
      method,
      headers: { ...this.defaultHeaders, ...headers },
      body: body ?? undefined,
    });

    const responseBody = method === "HEAD" ? "" : await response.text();
    const responseHeaders: Record<string, string[]> = {};

    response.headers.forEach((value, key) => {
      const existing = responseHeaders[key];
      if (existing) {
        existing.push(value);
      } else {
        responseHeaders[key] = [value];
      }
    });

    return {
      responseCode: response.status,
      responseMessage: response.statusText,
      responseHeaders,
      responseBody,
      latestUrl: response.url || url,
    };
  }
}
