import { router, publicProcedure } from "./trpc";

export const systemRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
  config: publicProcedure.query(() => ({
    hasSerpApi: !!process.env.SERPAPI_KEY,
  })),
});
