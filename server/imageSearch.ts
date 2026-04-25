/**
 * Image search service
 * Primary:  SerpApi (Google Images)
 * Fallback: Bing Images scraping → Yandex Images scraping
 * Supports: imageType, imageSize, imageColor, safeSearch, source override
 */

export interface ImageResult {
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  originalUrl?: string;
  width?: number;
  height?: number;
}

export interface SearchResponse {
  results: ImageResult[];
  source: "serpapi" | "bing" | "yandex";
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
export type SearchSource = "auto" | "serpapi" | "bing" | "yandex" | "google_lens";

export interface SearchFilters {
  imageType?: ImageType;
  imageSize?: ImageSize;
  imageColor?: ImageColor;
  safeSearch?: SafeSearch;
  source?: SearchSource;
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

const BING_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.bing.com/",
};

// ─── Yandex filter mappings ───────────────────────────────────────────────────
// Yandex uses itype=, isize=, icolor= query params

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

const YANDEX_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://yandex.com/images/",
};

// ─── SerpApi ──────────────────────────────────────────────────────────────────

async function searchViaSerpApi(
  query: string,
  start: number = 0,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");

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
  }));

  return {
    results,
    source: "serpapi",
    hasMore: results.length >= 20,
    total: data.search_information?.total_results,
  };
}

// ─── Google Lens (SerpApi) ───────────────────────────────────────────────────

export async function searchViaGoogleLens(
  imageUrl: string
): Promise<SearchResponse> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");

  const params: Record<string, string> = {
    engine: "google_lens",
    url: imageUrl,
    api_key: apiKey,
  };

  const url = `https://serpapi.com/search.json?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpApi Google Lens HTTP ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    visual_matches?: Array<{
      title?: string;
      thumbnail?: string;
      link?: string;
      source?: string;
    }>;
    error?: string;
  };

  if (data.error) throw new Error(`SerpApi error: ${data.error}`);

  const images = data.visual_matches ?? [];
  const results: ImageResult[] = images.map((img) => ({
    title: img.title ?? "",
    thumbnailUrl: img.thumbnail ?? "",
    sourceUrl: img.link ?? "",
    sourceDomain: img.source ?? extractDomain(img.link ?? ""),
    originalUrl: img.thumbnail ?? "",
  }));

  return {
    results,
    source: "serpapi",
    hasMore: false,
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
    headers: BING_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);

  const html = await res.text();
  const results = parseBingHtml(html);

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
  // Yandex embeds image data in data-bem='{"serp-item":{...}}' attributes
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

      // Yandex thumb URLs start with // — prepend https:
      let thumbUrl = si.thumb?.url ?? "";
      if (thumbUrl.startsWith("//")) thumbUrl = "https:" + thumbUrl;
      // Decode HTML entities in thumb URL
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
  // Yandex page number: p=0 is page 1, p=1 is page 2, etc.
  const page = Math.floor(start / 30);

  const params: Record<string, string> = {
    text: query,
    p: String(page),
    format: "json",
    request: JSON.stringify({
      blocks: [{ block: "serp-list_infinite_yes", params: {}, version: 2 }],
    }),
  };

  // Safe search: family=yes enables strict filtering
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
    headers: YANDEX_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Yandex HTTP ${res.status}`);

  const data = (await res.json()) as {
    blocks?: Array<{ html?: string; params?: { lastPage?: number } }>;
  };

  const block = data.blocks?.[0];
  const html = block?.html ?? "";
  const lastPage = block?.params?.lastPage ?? 1;

  const results = parseYandexHtml(html);

  return {
    results,
    source: "yandex",
    hasMore: page < lastPage && results.length >= 10,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchImages(
  query: string,
  start: number = 0,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const serpKey = process.env.SERPAPI_KEY;
  const requestedSource = filters.source ?? "auto";

  // Explicit source selection
  if (requestedSource === "google_lens") {
    return await searchViaGoogleLens(query); // here query is the imageUrl
  }
  if (requestedSource === "bing") {
    return await searchViaBing(query, start, filters);
  }
  if (requestedSource === "yandex") {
    return await searchViaYandex(query, start, filters);
  }
  if (requestedSource === "serpapi") {
    if (!serpKey) throw new Error("SerpApi key not configured");
    return await searchViaSerpApi(query, start, filters);
  }

  // Auto: try SerpApi → Bing → Yandex
  if (serpKey) {
    try {
      return await searchViaSerpApi(query, start, filters);
    } catch (err) {
      console.warn("[imageSearch] SerpApi failed, falling back to Bing:", err);
    }
  }

  try {
    return await searchViaBing(query, start, filters);
  } catch (err) {
    console.warn("[imageSearch] Bing failed, falling back to Yandex:", err);
  }

  return await searchViaYandex(query, start, filters);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
