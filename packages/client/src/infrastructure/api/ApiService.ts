import { NewPipeExtractor } from "@newpipe/extractor";
import type { YoutubeService } from "@newpipe/extractor";
import { ServiceId } from "@newpipe/shared";
import type {
  SearchResult,
  StreamInfo,
  ChannelInfo,
  ChannelTabInfo,
  PlaylistInfo,
  CommentInfo,
  KioskInfo,
  KioskType,
  Page,
  StreamInfoItem,
} from "@newpipe/shared";
import { initExtractor } from "@/infrastructure/extractor/extractorInit";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { executeWithResilience } from "@/infrastructure/resilience/ResilienceService";
import { ExtractorCache } from "@/infrastructure/resilience/ExtractorCache";
import type { ResilienceLevel } from "@/infrastructure/resilience/types";
import { fetchStreamInfoFromPiped } from "@/infrastructure/resilience/PipedApiService";

/**
 * Maps country codes to their primary language code for YouTube's `hl` parameter.
 */
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  AR: "es", AU: "en", AT: "de", BD: "bn", BE: "fr", BR: "pt",
  CA: "en", CL: "es", CO: "es", CZ: "cs", DE: "de", DK: "da",
  EG: "ar", ES: "es", FI: "fi", FR: "fr", GB: "en", GR: "el",
  HK: "zh-Hant", HU: "hu", ID: "id", IE: "en", IL: "he", IN: "hi",
  IT: "it", JP: "ja", KR: "ko", MA: "ar", MX: "es", MY: "ms",
  NG: "en", NL: "nl", NO: "no", NZ: "en", PE: "es", PH: "fil",
  PK: "ur", PL: "pl", PT: "pt", RO: "ro", RU: "ru", SA: "ar",
  SE: "sv", SG: "en", TH: "th", TR: "tr", TW: "zh-Hant", UA: "uk",
  US: "en", VE: "es", VN: "vi", ZA: "en",
};

/**
 * Returns the current content country and derived language from user settings.
 */
function getLocalization(): { country: string; language: string } {
  const country = useSettingsStore.getState().contentCountry;
  const language = COUNTRY_TO_LANGUAGE[country] ?? "en";
  return { country, language };
}

/**
 * Returns the streaming service for the given ID.
 * Ensures the extractor is initialized before use.
 */
function getService(serviceId: number) {
  initExtractor();
  return NewPipeExtractor.getService(serviceId as ServiceId);
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function fetchSearch(
  serviceId: number,
  query: string,
  contentFilter?: string,
  sortFilter?: string
): Promise<SearchResult> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  const filters = {
    contentFilters: contentFilter ? [contentFilter] : [],
    sortFilter: sortFilter ?? null,
  };
  return service.search(query, filters, language, country);
}

export async function fetchSearchNextPage(
  serviceId: number,
  query: string,
  page: Page,
  contentFilter?: string,
  sortFilter?: string
): Promise<SearchResult> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  const filters = {
    contentFilters: contentFilter ? [contentFilter] : [],
    sortFilter: sortFilter ?? null,
  };
  return service.searchNextPage(query, filters, page, language, country);
}

export async function fetchSuggestions(
  serviceId: number,
  query: string
): Promise<readonly string[]> {
  const service = getService(serviceId);
  return service.getSearchSuggestions(query);
}

// ─── Stream ──────────────────────────────────────────────────────────────────

/**
 * Fetches full stream info with a 4-level resilience cascade:
 *   1. Cache hit (instant, no network)
 *   2. Direct extraction via iOS client (default)
 *   3. Direct extraction via ANDROID client (rotation)
 *   4. Piped API fallback (external proxy)
 *
 * Successful results are cached for subsequent requests.
 */
export async function fetchStreamInfo(
  serviceId: number,
  url: string
): Promise<StreamInfo> {
  // Start periodic cache cleanup on first use
  ExtractorCache.startPeriodicCleanup();

  const cacheKey = ExtractorCache.buildKey("streamInfo", serviceId, url);

  // Level 0: Cache hit — return immediately without network
  const cached = await ExtractorCache.get<StreamInfo>(cacheKey);
  if (cached) {
    return cached;
  }

  const service = getService(serviceId);
  const { country, language } = getLocalization();

  // Build resilience cascade levels
  const levels: ResilienceLevel<StreamInfo>[] = [
    {
      name: "Direct (iOS)",
      execute: () => service.getStreamInfo(url, language, country),
    },
    {
      name: "Direct (Android)",
      execute: () =>
        (service as YoutubeService).getStreamInfoWithClient(url, "ANDROID", language, country),
    },
    {
      name: "Piped API",
      execute: () => fetchStreamInfoFromPiped(url),
    },
  ];

  const result = await executeWithResilience(levels);

  // Cache successful result for future requests
  ExtractorCache.set(cacheKey, result.data, "streamInfo").catch(() => {});

  return result.data;
}

// ─── Channel ─────────────────────────────────────────────────────────────────

export async function fetchChannelInfo(
  serviceId: number,
  url: string
): Promise<ChannelInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getChannelInfo(url, language, country);
}

export async function fetchChannelTabInfo(
  serviceId: number,
  url: string,
  tab: string
): Promise<ChannelTabInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getChannelTabInfo(url, tab, language, country);
}

export async function fetchChannelTabNextPage(
  serviceId: number,
  url: string,
  tab: string,
  page: Page
): Promise<ChannelTabInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getChannelTabNextPage(url, tab, page, language, country);
}

// ─── Playlist ────────────────────────────────────────────────────────────────

export async function fetchPlaylistInfo(
  serviceId: number,
  url: string
): Promise<PlaylistInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getPlaylistInfo(url, language, country);
}

export async function fetchPlaylistNextPage(
  serviceId: number,
  url: string,
  page: Page
): Promise<{ items: readonly StreamInfoItem[]; nextPage: Page | null }> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getPlaylistNextPage(url, page, language, country);
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchCommentsInfo(
  serviceId: number,
  url: string
): Promise<CommentInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getCommentsInfo(url, language, country);
}

export async function fetchCommentsNextPage(
  serviceId: number,
  url: string,
  page: Page
): Promise<CommentInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  return service.getCommentsNextPage(url, page, language, country);
}

// ─── Kiosk ───────────────────────────────────────────────────────────────────

export async function fetchKioskInfo(
  serviceId: number,
  type: KioskType
): Promise<KioskInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  try {
    const result = await service.getKioskInfo(type, language, country);
    if (result.items.length > 0) {
      return result;
    }
  } catch {
    // Browse endpoint failed, fall through to search-based fallback
  }

  try {
    const fallback = await fetchTrendingViaSearch(serviceId, type);
    return fallback;
  } catch {
    return {
      serviceId: serviceId as ServiceId,
      url: "",
      name: type,
      kioskType: type,
      items: [],
      nextPage: null,
    };
  }
}

export async function fetchKioskNextPage(
  serviceId: number,
  type: KioskType,
  page: Page
): Promise<{ items: readonly StreamInfoItem[]; nextPage: Page | null }> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  try {
    return await service.getKioskNextPage(type, page, language, country);
  } catch {
    return { items: [], nextPage: null };
  }
}

// ─── Trending via Search (fallback) ──────────────────────────────────────────

const TRENDING_QUERIES: Record<string, readonly string[]> = {
  es: ["tendencias hoy", "música popular", "vídeos virales", "noticias hoy", "deportes highlights", "humor español", "lo más visto"],
  pt: ["tendências hoje", "música popular", "vídeos virais", "notícias hoje", "esportes", "humor brasileiro", "mais vistos"],
  fr: ["tendances aujourd'hui", "musique populaire", "vidéos virales", "actualités", "sport", "humour français", "les plus vus"],
  de: ["trends heute", "beliebte Musik", "virale Videos", "Nachrichten heute", "Sport Highlights", "Comedy deutsch", "meistgesehen"],
  it: ["tendenze oggi", "musica popolare", "video virali", "notizie oggi", "sport highlights", "commedia italiana", "più visti"],
  ja: ["急上昇", "人気の音楽", "バイラル動画", "ニュース今日", "スポーツ", "お笑い", "最も再生"],
  ko: ["인기 급상승", "인기 음악", "바이럴 영상", "오늘 뉴스", "스포츠 하이라이트", "코미디", "조회수 높은"],
  en: ["trending videos today", "popular music videos", "viral videos", "new music", "gaming highlights", "sports highlights", "news today", "comedy sketches"],
};

/**
 * Returns trending queries for the current language, falling back to English.
 */
function getTrendingQueries(language: string): readonly string[] {
  const baseLanguage = language.split("-")[0]!;
  return TRENDING_QUERIES[baseLanguage] ?? TRENDING_QUERIES["en"]!;
}

/**
 * Fetches popular content by combining results from multiple search queries.
 * Used as a fallback when YouTube's InnerTube browse API returns errors.
 *
 * Strategy: Fire parallel searches with diverse queries, collect video results,
 * deduplicate by URL, shuffle for variety, and return as a KioskInfo.
 */
async function fetchTrendingViaSearch(
  serviceId: number,
  kioskType: KioskType
): Promise<KioskInfo> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  const filters = {
    contentFilters: ["Videos"],
    sortFilter: null,
  };

  // Fire 4 random queries in parallel for speed and variety
  const queries = getTrendingQueries(language);
  const selectedQueries = shuffleArray([...queries]).slice(0, 4);
  const searchPromises = selectedQueries.map((query) =>
    service.search(query, filters, language, country).catch(() => null)
  );

  const results = await Promise.all(searchPromises);

  // Collect all video items, dedup by URL
  const seen = new Set<string>();
  const allItems: StreamInfoItem[] = [];

  for (const result of results) {
    if (!result) continue;
    for (const item of result.items) {
      if ("streamType" in item && !seen.has(item.url)) {
        seen.add(item.url);
        allItems.push(item);
      }
    }
  }

  // Shuffle for variety across categories
  const shuffled = shuffleArray(allItems);

  return {
    serviceId: serviceId as ServiceId,
    url: "https://www.youtube.com/feed/trending",
    name: kioskType,
    kioskType,
    items: shuffled,
    nextPage: null,
  };
}

/**
 * Fisher-Yates shuffle for uniform randomization.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

// ─── Shorts via Search ───────────────────────────────────────────────────────

/**
 * Fetches short-form content using YouTube search.
 * Searches for "shorts" and filters results by duration (≤ 60 seconds).
 */
export async function fetchShortsContent(
  serviceId: number
): Promise<readonly StreamInfoItem[]> {
  const service = getService(serviceId);
  const { country, language } = getLocalization();
  const filters = {
    contentFilters: ["Videos"],
    sortFilter: null,
  };

  const queries = ["shorts", "viral shorts", "#shorts trending"];
  const selectedQueries = shuffleArray([...queries]).slice(0, 2);
  const searchPromises = selectedQueries.map((query) =>
    service.search(query, filters, language, country).catch(() => null)
  );

  const results = await Promise.all(searchPromises);

  const seen = new Set<string>();
  const shorts: StreamInfoItem[] = [];

  for (const result of results) {
    if (!result) continue;
    for (const item of result.items) {
      if (
        "streamType" in item &&
        !seen.has(item.url) &&
        item.duration > 0 &&
        item.duration <= 180 // Shorts are typically ≤ 60s, allow up to 3min for variety
      ) {
        seen.add(item.url);
        shorts.push(item);
      }
    }
  }

  return shuffleArray(shorts);
}
