import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { searchImages } from "./imageSearch";
import { markSeen, getSeenUrls, clearSeen } from "./db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

const imageTypeSchema = z.enum(["all","photo","clipart","gif","lineart","face"]).default("all");
const imageSizeSchema = z.enum(["all","Small","Medium","Large","Wallpaper"]).default("all");
const imageColorSchema = z.enum(["all","color","Monochrome","Red","Orange","Yellow","Green","Blue","Purple","Pink","Brown","Black","Gray","Teal","White"]).default("all");
const safeSearchSchema = z.enum(["active","off"]).default("active");
const searchSourceSchema = z.enum(["auto","serpapi","bing","yandex"]).default("auto");

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
        filterSeen: z.boolean().default(false),
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

          if (input.filterSeen) {
            const sid = getOrCreateSession(ctx.req, ctx.res);
            const seen = await getSeenUrls(sid);
            response.results = response.results.filter(
              (r) => !seen.has(r.thumbnailUrl) && !seen.has(r.originalUrl ?? "")
            );
          }

          return response;
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
