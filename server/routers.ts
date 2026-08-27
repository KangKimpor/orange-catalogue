import { router } from "./_core/trpc";
import { storeRouter } from "./storeRouter";

export const appRouter = router({
  store: storeRouter,
});

export type AppRouter = typeof appRouter;
