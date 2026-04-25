import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { searchImages, type ImageResult, type SearchSource } from "./imageSearch";
import { markSeen, getSeenUrls, clearSeen } from "./db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

const imageTypeSchema = z.enum(["all","photo","clipart","gif","lineart","face"]).default("all");
const imageSizeSchema = z.enum(["all","Small","Medium","Large","Wallpaper"]).default("all");
const imageColorSchema = z.enum(["all","color","Monochrome","Red","Orange","Yellow","Green","Blue","Purple","Pink","Brown","Black","Gray","Teal","White"]).default("all");
const safeSearchSchema = z.enum(["active","off"]).default("active");
const searchSourceSchema = z.enum(["auto","serpapi","bing","yandex","google_lens"]).default("auto");

// Simple session ID from cookie or generate new one
function getOrCreateSession(req: any, res: any): string {
  let sid = req.cookies?.visua_sid;
  if (!sid) {
    sid = crypto.randomUUID();
    res.cookie("visua_sid", sid, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }
  return sid;
}

export const appRouter = router({
  system: systemRouter,

  search: router({
    lens: publicProcedure
      .input(z.object({ imageUrl: z.string().url() }))
      .mutation(async ({ input }) => {
        try {
          const response = await searchImages(input.imageUrl, 0, { source: "google_lens" });
          return response;
        } catch (err) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err instanceof Error ? err.message : "Lens search failed",
          });
        }
      }),

    images: publicProcedure
      .input(z.object({
        query: z.string().min(1).max(200),
        start: z.number().int().min(0).default(0),
        imageType: imageTypeSchema.optional(),
        imageSize: imageSizeSchema.optional(),
        imageColor: imageColorSchema.optional(),
        safeSearch: safeSearchSchema.optional(),
        source: searchSourceSchema.optional(),
        filterSeen: z.boolean().default(false),
      }))
      .query(async ({ input, ctx }) => {
        try {
          let currentStart = input.start;
          let allResultsFiltered: ImageResult[] = [];
          let hasMore = true;
          let source: SearchSource = "auto";
          let attempts = 0;

          // If filtering seen, we might need to fetch more pages if everything on the first page is seen
          while (allResultsFiltered.length < 10 && attempts < 3 && hasMore) {
            const response = await searchImages(input.query, currentStart, {
              imageType: input.imageType,
              imageSize: input.imageSize,
              imageColor: input.imageColor,
              safeSearch: input.safeSearch,
              source: input.source,
            });

            source = response.source;
            hasMore = response.hasMore;

            let results = response.results;
            if (input.filterSeen) {
              const sid = getOrCreateSession(ctx.req, ctx.res);
              const seen = await getSeenUrls(sid);
              results = results.filter(
                (r) => !seen.has(r.thumbnailUrl) && !seen.has(r.originalUrl ?? "")
              );
            }

            allResultsFiltered = [...allResultsFiltered, ...results];
            if (allResultsFiltered.length >= 10 || !input.filterSeen) break;

            currentStart += response.results.length || 20;
            attempts++;
          }

          return {
            results: allResultsFiltered,
            source,
            hasMore,
            nextStart: currentStart,
          };
        } catch (err) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err instanceof Error ? err.message : "Search failed",
          });
        }
      }),
  }),

  seen: router({
    mark: publicProcedure
      .input(z.object({ urls: z.array(z.string()) }))
      .mutation(async ({ input, ctx }) => {
        const sid = getOrCreateSession(ctx.req, ctx.res);
        await markSeen(sid, input.urls);
        return { ok: true };
      }),

    clear: publicProcedure
      .mutation(async ({ ctx }) => {
        const sid = getOrCreateSession(ctx.req, ctx.res);
        await clearSeen(sid);
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
