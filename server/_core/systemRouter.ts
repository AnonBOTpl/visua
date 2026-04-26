import { router, publicProcedure } from "./trpc";
import { getSettings, setSetting, setManySettings } from "../db";
import { z } from "zod";

export const systemRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),

  settings: router({
    get: publicProcedure.query(async () => {
      const all = await getSettings();
      // Protect API keys
      const brave_api_key_set = !!all.brave_api_key;
      const serpapi_key_set = !!all.serpapi_key;

      const { brave_api_key, serpapi_key, ...rest } = all;
      return {
        ...rest,
        brave_api_key_set,
        serpapi_key_set,
      };
    }),

    set: publicProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await setSetting(input.key, input.value);
        return { ok: true };
      }),

    setMany: publicProcedure
      .input(z.object({ settings: z.array(z.object({ key: z.string(), value: z.string() })) }))
      .mutation(async ({ input }) => {
        await setManySettings(input.settings);
        return { ok: true };
      }),
  }),
});
