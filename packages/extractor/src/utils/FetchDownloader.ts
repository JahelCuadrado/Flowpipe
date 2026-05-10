import type { Downloader, DownloaderResponse } from "../core/types.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0";

/**
 * HTTP client implementation using the Fetch API.
 * Works in both browser (including Capacitor WebView) and Node.js 18+.
 *
 * When a `corsProxyUrl` is provided (browser dev mode), all requests are
 * routed through the proxy as: `{corsProxyUrl}/proxy?url={encodedTargetUrl}`.
 * In production (Capacitor APK), Capacitor's native HTTP plugin automatically
 * patches fetch() to bypass CORS — no proxy needed.
 */
export class FetchDownloader implements Downloader {
  private readonly defaultHeaders: Record<string, string>;
  private readonly corsProxyUrl: string | null;

  constructor(
    userAgent?: string,
    extraHeaders?: Record<string, string>,
    corsProxyUrl?: string | null
  ) {
    this.corsProxyUrl = corsProxyUrl ?? null;
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

  private resolveUrl(url: string): string {
    if (!this.corsProxyUrl) {
      return url;
    }
    return `${this.corsProxyUrl}?url=${encodeURIComponent(url)}`;
  }

  private async execute(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<DownloaderResponse> {
    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    const resolvedUrl = this.resolveUrl(url);

    const response = await fetch(resolvedUrl, {
      method,
      headers: mergedHeaders,
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
