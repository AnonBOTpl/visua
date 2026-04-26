import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { searchImages, type SearchSource } from "./imageSearch";
import { markSeen, getSeenUrls, clearSeen, addFavorite, removeFavorite, getFavorites } from "./db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

const imageTypeSchema = z.enum(["all","photo","clipart","gif","lineart","face"]).default("all");
const imageSizeSchema = z.enum(["all","Small","Medium","Large","Wallpaper"]).default("all");
const imageColorSchema = z.enum(["all","color","Monochrome","Red","Orange","Yellow","Green","Blue","Purple","Pink","Brown","Black","Gray","Teal","White"]).default("all");
const safeSearchSchema = z.enum(["active","off"]).default("active");
const searchSourceSchema = z.union([
  z.enum(["auto","serpapi","bing","yandex"]),
  z.array(z.enum(["serpapi","bing","yandex"]))
]).default("auto");

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
    images: publicProcedure
      .input(z.object({
        query: z.string().min(1).max(200),
        start: z.number().int().min(0).default(0),
        imageType: imageTypeSchema.optional(),
        imageSize: imageSizeSchema.optional(),
        imageColor: imageColorSchema.optional(),
        safeSearch: safeSearchSchema.optional(),
        source: searchSourceSchema.optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const response = await searchImages(input.query, input.start, {
            imageType: input.imageType,
            imageSize: input.imageSize,
            imageColor: input.imageColor,
            safeSearch: input.safeSearch,
            source: input.source,
          });

          const sid = getOrCreateSession(ctx.req, ctx.res);
          const seenSet = await getSeenUrls(sid);

          const results = response.results.map(r => ({
            ...r,
            isSeen: seenSet.has(r.thumbnailUrl) || seenSet.has(r.originalUrl ?? "")
          }));

          return {
            results,
            source: response.source,
            hasMore: response.hasMore,
            nextStart: input.start + response.results.length,
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

  favs: router({
    add: publicProcedure
      .input(z.object({
        title: z.string().optional().nullable(),
        thumbnailUrl: z.string(),
        sourceUrl: z.string().optional().nullable(),
        originalUrl: z.string().optional().nullable(),
        sourceDomain: z.string().optional().nullable(),
        width: z.number().optional().nullable(),
        height: z.number().optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const sid = getOrCreateSession(ctx.req, ctx.res);
        await addFavorite(sid, input);
        return { ok: true };
      }),

    remove: publicProcedure
      .input(z.object({ thumbnailUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const sid = getOrCreateSession(ctx.req, ctx.res);
        await removeFavorite(sid, input.thumbnailUrl);
        return { ok: true };
      }),

    list: publicProcedure.query(async ({ ctx }) => {
      const sid = getOrCreateSession(ctx.req, ctx.res);
      return await getFavorites(sid);
    }),
  }),
});

export type AppRouter = typeof appRouter;
