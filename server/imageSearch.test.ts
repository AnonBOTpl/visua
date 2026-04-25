/**
 * Tests for imageSearch service
 * Primary: SerpApi (Google Images)
 * Fallback: Bing Images scraping
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock fetch globally ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSerpApiResponse(count = 3) {
  return {
    images_results: Array.from({ length: count }, (_, i) => ({
      title: `SerpApi Image ${i + 1}`,
      thumbnail: `https://thumb.example.com/serpapi-${i + 1}.jpg`,
      link: `https://source.example.com/page-${i + 1}`,
      original: `https://original.example.com/serpapi-${i + 1}.jpg`,
      source: `source${i + 1}.example.com`,
      original_width: 800,
      original_height: 600,
    })),
    search_information: { total_results: count },
  };
}

/** Minimal Bing HTML fragment with iusc m= attributes */
function makeBingHtml(count = 3): string {
  const items = Array.from({ length: count }, (_, i) => {
    const data = JSON.stringify({
      murl: `https://original.example.com/bing-${i + 1}.jpg`,
      turl: `https://tse1.mm.bing.net/th?id=bing-${i + 1}`,
      purl: `https://source.example.com/bing-page-${i + 1}`,
      t: `Bing Image ${i + 1}`,
      desc: `Description ${i + 1}`,
    }).replace(/"/g, "&quot;");
    return `<div class="iusc" m="${data}"></div>`;
  });
  return `<html><body>${items.join("\n")}</body></html>`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("imageSearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.SERPAPI_KEY;
  });

  // ── SerpApi primary path ──────────────────────────────────────────────────

  describe("SerpApi primary path", () => {
    it("returns results from SerpApi when key is set and API succeeds", async () => {
      process.env.SERPAPI_KEY = "test-key-123";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(5),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("cats");
      expect(result.source).toBe("serpapi");
      expect(result.results).toHaveLength(5);
      expect(result.results[0]).toMatchObject({
        title: "SerpApi Image 1",
        thumbnailUrl: "https://thumb.example.com/serpapi-1.jpg",
        sourceDomain: "source1.example.com",
      });
    });

    it("passes safe=active to SerpApi when safeSearch is active", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { safeSearch: "active" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("safe=active");
    });

    it("passes safe=off to SerpApi when safeSearch is off", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { safeSearch: "off" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("safe=off");
    });

    it("passes image_type to SerpApi when imageType is set", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { imageType: "gif" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("image_type=animated");
    });

    it("passes image_color to SerpApi when imageColor is set", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { imageColor: "Red" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("image_color=red");
    });

    it("passes tbs size param to SerpApi when imageSize is set", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { imageSize: "Large" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("tbs=isz%3Al");
    });
  });

  // ── Bing fallback ─────────────────────────────────────────────────────────

  describe("Bing fallback", () => {
    it("returns results from Bing with correct shape", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => makeBingHtml(4),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("cats", 0, { source: "bing" });
      expect(result.source).toBe("bing");
      expect(result.results).toHaveLength(4);
      expect(result.results[0]).toMatchObject({
        title: "Bing Image 1",
        thumbnailUrl: "https://tse1.mm.bing.net/th?id=bing-1",
        sourceUrl: "https://source.example.com/bing-page-1",
        originalUrl: "https://original.example.com/bing-1.jpg",
      });
    });

    it("falls back to Bing when SerpApi returns HTTP error in auto mode", async () => {
      process.env.SERPAPI_KEY = "test-key-123";
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => makeBingHtml(4),
        });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("cats");
      expect(result.source).toBe("bing");
      expect(result.results).toHaveLength(4);
    });

    it("falls back to Bing when SerpApi returns error field in JSON", async () => {
      process.env.SERPAPI_KEY = "test-key-123";
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: "Your account has run out of searches." }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => makeBingHtml(3),
        });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("dogs");
      expect(result.source).toBe("bing");
      expect(result.results).toHaveLength(3);
    });

    it("passes imageSize filter to Bing qft parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => makeBingHtml(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { source: "bing", imageSize: "Large" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      // The URL is encoded, so check for the encoded form
      expect(decodeURIComponent(calledUrl)).toContain("filterui:imagesize-large");
    });

    it("passes safe search to Bing adlt parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => makeBingHtml(2),
      });
      const { searchImages } = await import("./imageSearch");
      await searchImages("cats", 0, { source: "bing", safeSearch: "off" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("adlt=off");
    });

    it("throws when Bing returns non-ok HTTP status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });
      const { searchImages } = await import("./imageSearch");
      await expect(
        searchImages("cats", 0, { source: "bing" })
      ).rejects.toThrow("Bing HTTP 503");
    });
  });

  // ── Source selection ──────────────────────────────────────────────────────

  describe("Source selection", () => {
    it("uses Bing directly when source=bing regardless of SERPAPI_KEY", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => makeBingHtml(3),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("cats", 0, { source: "bing" });
      expect(result.source).toBe("bing");
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("bing.com");
      // SerpApi should NOT have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("uses SerpApi directly when source=serpapi", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(3),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("cats", 0, { source: "serpapi" });
      expect(result.source).toBe("serpapi");
    });

    it("uses Bing when no SERPAPI_KEY and source=auto", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => makeBingHtml(6),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("mountains");
      expect(result.source).toBe("bing");
      expect(result.results).toHaveLength(6);
    });
  });

  // ── Result shape ──────────────────────────────────────────────────────────

  describe("Result shape", () => {
    it("each result has required fields", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(1),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("test");
      const img = result.results[0];
      expect(img).toHaveProperty("title");
      expect(img).toHaveProperty("thumbnailUrl");
      expect(img).toHaveProperty("sourceUrl");
      expect(img).toHaveProperty("sourceDomain");
      expect(typeof img.title).toBe("string");
      expect(typeof img.thumbnailUrl).toBe("string");
    });

    it("hasMore is true when results count >= 20", async () => {
      process.env.SERPAPI_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeSerpApiResponse(25),
      });
      const { searchImages } = await import("./imageSearch");
      const result = await searchImages("test");
      expect(result.hasMore).toBe(true);
    });
  });
});
