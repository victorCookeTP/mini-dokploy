import { router } from "../router";
import { deploymentsRouter } from "./deployments";

export const appRouter = router({
  deployments: deploymentsRouter,
});

export type AppRouter = typeof appRouter;