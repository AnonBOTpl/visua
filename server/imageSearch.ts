/**
 * Image search service
 * Sources: Bing, Yandex, Brave, SerpApi
 */
import { getSettings } from "./db";

export interface ImageResult {
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  source?: "serpapi" | "bing" | "yandex" | "brave";
}

export interface SearchResponse {
  results: ImageResult[];
  source: "serpapi" | "bing" | "yandex" | "brave" | "mixed";
  sources?: string[];
  hasMore: boolean;
  total?: number;
}

export type ImageType = "all" | "photo" | "clipart" | "gif" | "lineart" | "face";
export type ImageSize = "all" | "Small" | "Medium" | "Large" | "Wallpaper";
export type ImageColor =
  | "all" | "color" | "Monochrome"
  | "Red" | "Orange" | "Yellow" | "Green" | "Blue"
  | "Purple" | "Pink" | "Brown" | "Black" | "Gray" | "Teal" | "White";
export type SafeSearch = "active" | "off";
export type SearchSource = "auto" | "serpapi" | "bing" | "yandex" | "brave" | string[];

export interface SearchFilters {
  imageType?: ImageType;
  imageSize?: ImageSize;
  imageColor?: ImageColor;
  safeSearch?: SafeSearch;
  source?: SearchSource;
}

// ─── User-Agent Rotation ──────────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── SerpApi filter mappings ──────────────────────────────────────────────────

const SERPAPI_TYPE_MAP: Record<string, string> = {
  photo: "photo",
  clipart: "clipart",
  gif: "animated",
  lineart: "lineart",
  face: "face",
};

const SERPAPI_SIZE_MAP: Record<string, string> = {
  Small: "isz:s",
  Medium: "isz:m",
  Large: "isz:l",
  Wallpaper: "isz:lt,islt:4mp",
};

const SERPAPI_COLOR_MAP: Record<string, string> = {
  color: "color",
  Monochrome: "bw",
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Blue: "blue",
  Purple: "purple",
  Pink: "pink",
  Brown: "brown",
  Black: "black",
  Gray: "gray",
  Teal: "teal",
  White: "white",
};

// ─── Bing filter mappings ─────────────────────────────────────────────────────

const BING_TYPE_MAP: Record<string, string> = {
  photo: "photo",
  clipart: "clipart",
  gif: "animatedgif",
  lineart: "linedrawing",
  face: "face",
};

const BING_SIZE_MAP: Record<string, string> = {
  Small: "small",
  Medium: "medium",
  Large: "large",
  Wallpaper: "wallpaper",
};

const BING_COLOR_MAP: Record<string, string> = {
  color: "color",
  Monochrome: "monochrome",
  Red: "FGcls_RED",
  Orange: "FGcls_ORANGE",
  Yellow: "FGcls_YELLOW",
  Green: "FGcls_GREEN",
  Blue: "FGcls_BLUE",
  Purple: "FGcls_PURPLE",
  Pink: "FGcls_PINK",
  Brown: "FGcls_BROWN",
  Black: "FGcls_BLACK",
  Gray: "FGcls_GRAY",
  Teal: "FGcls_TEAL",
  White: "FGcls_WHITE",
};

// ─── Yandex filter mappings ───────────────────────────────────────────────────

const YANDEX_TYPE_MAP: Record<string, string> = {
  photo: "photo",
  clipart: "clipart",
  gif: "gif",
  lineart: "graphics",
  face: "face",
};

const YANDEX_SIZE_MAP: Record<string, string> = {
  Small: "small",
  Medium: "medium",
  Large: "large",
  Wallpaper: "wallpaper",
};

const YANDEX_COLOR_MAP: Record<string, string> = {
  color: "color",
  Monochrome: "gray",
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Blue: "blue",
  Purple: "violet",
  Pink: "pink",
  Brown: "brown",
  Black: "black",
  Gray: "gray",
  Teal: "cyan",
  White: "white",
};

// ─── SerpApi ──────────────────────────────────────────────────────────────────

async function searchViaSerpApi(
  query: string,
  start: number = 0,
  filters: SearchFilters = {},
  apiKey: string
): Promise<SearchResponse> {
  const params: Record<string, string> = {
    engine: "google_images",
    q: query,
    ijn: String(Math.floor(start / 100)),
    start: String(start),
    api_key: apiKey,
    safe: filters.safeSearch === "active" ? "active" : "off",
    num: "100",
  };

  if (filters.imageType && filters.imageType !== "all") {
    const mapped = SERPAPI_TYPE_MAP[filters.imageType];
    if (mapped) params.image_type = mapped;
  }

  const tbsParts: string[] = [];
  if (filters.imageSize && filters.imageSize !== "all") {
    const mapped = SERPAPI_SIZE_MAP[filters.imageSize];
    if (mapped) tbsParts.push(mapped);
  }
  if (tbsParts.length > 0) params.tbs = tbsParts.join(",");

  if (filters.imageColor && filters.imageColor !== "all") {
    const mapped = SERPAPI_COLOR_MAP[filters.imageColor];
    if (mapped) params.image_color = mapped;
  }

  const url = `https://serpapi.com/search.json?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpApi HTTP ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    images_results?: Array<{
      title?: string;
      thumbnail?: string;
      link?: string;
      original?: string;
      source?: string;
      original_width?: number;
      original_height?: number;
    }>;
    error?: string;
    search_information?: { total_results?: number };
  };

  if (data.error) throw new Error(`SerpApi error: ${data.error}`);

  const images = data.images_results ?? [];
  const results: ImageResult[] = images.map((img) => ({
    title: img.title ?? "",
    thumbnailUrl: img.thumbnail ?? img.original ?? "",
    sourceUrl: img.link ?? "",
    sourceDomain: img.source ?? extractDomain(img.link ?? ""),
    originalUrl: img.original,
    width: img.original_width,
    height: img.original_height,
    source: "serpapi",
  }));

  return {
    results,
    source: "serpapi",
    hasMore: results.length >= 20,
    total: data.search_information?.total_results,
  };
}

// ─── Bing Images scraping ─────────────────────────────────────────────────────

function buildBingQft(filters: SearchFilters): string {
  const parts: string[] = [];

  if (filters.imageType && filters.imageType !== "all") {
    const mapped = BING_TYPE_MAP[filters.imageType];
    if (mapped) parts.push(`+filterui:photo-${mapped}`);
  }

  if (filters.imageSize && filters.imageSize !== "all") {
    const mapped = BING_SIZE_MAP[filters.imageSize];
    if (mapped) parts.push(`+filterui:imagesize-${mapped}`);
  }

  if (filters.imageColor && filters.imageColor !== "all") {
    const mapped = BING_COLOR_MAP[filters.imageColor];
    if (mapped) {
      if (mapped === "color" || mapped === "monochrome") {
        parts.push(`+filterui:color2-${mapped}`);
      } else {
        parts.push(`+filterui:color2-FGcls_${filters.imageColor.toUpperCase()}`);
      }
    }
  }

  return parts.join("");
}

interface BingImageData {
  murl?: string;
  turl?: string;
  purl?: string;
  t?: string;
  desc?: string;
  md5?: string;
}

function parseBingHtml(html: string): ImageResult[] {
  const results: ImageResult[] = [];
  const iuscPattern = /class="iusc"[^>]*m="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = iuscPattern.exec(html)) !== null) {
    try {
      const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      const obj = JSON.parse(raw) as BingImageData;
      if (!obj.murl && !obj.turl) continue;

      const sourceUrl = obj.purl ?? "";
      results.push({
        title: obj.t ?? obj.desc ?? "",
        thumbnailUrl: (obj.turl ?? "").replace(/&amp;/g, "&"),
        sourceUrl,
        sourceDomain: extractDomain(sourceUrl),
        originalUrl: obj.murl,
      });
    } catch {
      // skip malformed entries
    }
  }

  return results;
}

async function searchViaBing(
  query: string,
  start: number = 0,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const safeParam = filters.safeSearch === "off" ? "off" : "moderate";
  const qft = buildBingQft(filters);
  const first = start + 1;

  const params = new URLSearchParams({
    q: query,
    first: String(first),
    count: "20",
    adlt: safeParam,
    qft,
  });

  const url = `https://www.bing.com/images/async?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.bing.com/",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);

  const html = await res.text();
  const results = parseBingHtml(html).map(r => ({ ...r, source: "bing" as const }));

  return {
    results,
    source: "bing",
    hasMore: results.length >= 18,
  };
}

// ─── Yandex Images scraping ───────────────────────────────────────────────────

interface YandexSerpItem {
  preview?: Array<{ url?: string; w?: number; h?: number }>;
  thumb?: { url?: string };
  snippet?: { title?: string };
  img_href?: string;
  useProxy?: boolean;
}

function parseYandexHtml(html: string): ImageResult[] {
  const results: ImageResult[] = [];
  const pattern = /data-bem='(\{[^']+\})'/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const obj = JSON.parse(match[1]) as Record<string, unknown>;
      const si = obj["serp-item"] as YandexSerpItem | undefined;
      if (!si) continue;

      const preview = si.preview?.[0];
      const originalUrl = preview?.url ?? "";
      if (!originalUrl) continue;

      let thumbUrl = si.thumb?.url ?? "";
      if (thumbUrl.startsWith("//")) thumbUrl = "https:" + thumbUrl;
      thumbUrl = thumbUrl.replace(/&amp;/g, "&");

      const sourceUrl = si.img_href ?? "";
      const title = si.snippet?.title ?? "";

      results.push({
        title,
        thumbnailUrl: thumbUrl || originalUrl,
        sourceUrl,
        sourceDomain: extractDomain(sourceUrl),
        originalUrl,
        width: preview?.w,
        height: preview?.h,
      });
    } catch {
      // skip malformed entries
    }
  }

  return results;
}

async function searchViaYandex(
  query: string,
  start: number = 0,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const page = Math.floor(start / 30);

  const params: Record<string, string> = {
    text: query,
    p: String(page),
    format: "json",
    request: JSON.stringify({
      blocks: [{ block: "serp-list_infinite_yes", params: {}, version: 2 }],
    }),
  };

  if (filters.safeSearch === "active") {
    params.family = "yes";
  }

  if (filters.imageType && filters.imageType !== "all") {
    const mapped = YANDEX_TYPE_MAP[filters.imageType];
    if (mapped) params.itype = mapped;
  }

  if (filters.imageSize && filters.imageSize !== "all") {
    const mapped = YANDEX_SIZE_MAP[filters.imageSize];
    if (mapped) params.isize = mapped;
  }

  if (filters.imageColor && filters.imageColor !== "all") {
    const mapped = YANDEX_COLOR_MAP[filters.imageColor];
    if (mapped) params.icolor = mapped;
  }

  const url = `https://yandex.com/images/search?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://yandex.com/images/",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Yandex HTTP ${res.status}`);

  const data = (await res.json()) as {
    blocks?: Array<{ html?: string; params?: { lastPage?: number } }>;
  };

  const block = data.blocks?.[0];
  const html = block?.html ?? "";
  const lastPage = block?.params?.lastPage ?? 1;

  const results = parseYandexHtml(html).map(r => ({ ...r, source: "yandex" as const }));

  return {
    results,
    source: "yandex",
    hasMore: page < lastPage && results.length >= 10,
  };
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function searchViaBrave(
  query: string,
  start: number = 0,
  filters: SearchFilters = {},
  apiKey: string,
  settings: Record<string, string>
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    count: "150",
    safesearch: filters.safeSearch === "active" ? "strict" : "off",
    search_lang: settings.search_lang || "en",
    country: settings.search_country || "ALL",
    offset: String(start),
  });

  const url = `https://api.search.brave.com/res/v1/images/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brave HTTP ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      title: string;
      url: string;
      thumbnail: { src: string };
      properties: { url: string; width: number; height: number };
      meta_url: { hostname: string };
    }>;
  };

  const results: ImageResult[] = (data.results ?? []).map(img => ({
    title: img.title,
    thumbnailUrl: img.thumbnail.src,
    sourceUrl: img.url,
    sourceDomain: img.meta_url.hostname,
    originalUrl: img.properties.url,
    width: img.properties.width,
    height: img.properties.height,
    source: "brave",
  }));

  return {
    results,
    source: "brave",
    hasMore: results.length >= 100,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchImages(
  query: string,
  start: number = 0,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const settings = await getSettings();
  let requestedSources: string[] = [];

  if (filters.source === "auto" || !filters.source) {
    requestedSources = ["bing", "yandex"];
    if (settings.brave_enabled === "true" && (settings.brave_api_key || process.env.BRAVE_API_KEY)) {
      requestedSources.push("brave");
    }
    if (settings.serpapi_enabled === "true" && (settings.serpapi_key || process.env.SERPAPI_KEY)) {
      requestedSources.push("serpapi");
    }
  } else if (Array.isArray(filters.source)) {
    requestedSources = filters.source;
  } else {
    requestedSources = [filters.source as string];
  }

  // Execute searches in parallel
  const promises = requestedSources.map(s => {
    if (s === "bing") return searchViaBing(query, start, filters).catch(() => null);
    if (s === "yandex") return searchViaYandex(query, start, filters).catch(() => null);
    if (s === "brave") {
      const key = settings.brave_api_key || process.env.BRAVE_API_KEY;
      if (key) return searchViaBrave(query, start, filters, key, settings).catch(() => null);
    }
    if (s === "serpapi") {
      const key = settings.serpapi_key || process.env.SERPAPI_KEY;
      if (key) return searchViaSerpApi(query, start, filters, key).catch(() => null);
    }
    return Promise.resolve(null);
  });

  const responses = (await Promise.all(promises)).filter((r): r is SearchResponse => r !== null);

  if (responses.length === 0) {
    throw new Error("Wszystkie źródła wyszukiwania zawiodły");
  }

  if (responses.length === 1) {
    return { ...responses[0], sources: requestedSources };
  }

  // Interleave and deduplicate results
  const combined: ImageResult[] = [];
  const seenThumbs = new Set<string>();
  const seenOriginals = new Set<string>();
  const maxResults = Math.max(...responses.map(r => r.results.length));

  for (let i = 0; i < maxResults; i++) {
    for (const resp of responses) {
      const item = resp.results[i];
      if (item) {
        const thumbUrl = item.thumbnailUrl;
        const originalUrl = item.originalUrl || "";
        if (!seenThumbs.has(thumbUrl) && (!originalUrl || !seenOriginals.has(originalUrl))) {
          combined.push(item);
          seenThumbs.add(thumbUrl);
          if (originalUrl) seenOriginals.add(originalUrl);
        }
      }
    }
  }

  return {
    results: combined,
    source: "mixed",
    sources: responses.map(r => r.source),
    hasMore: responses.some(r => r.hasMore),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
